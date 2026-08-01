# 异步生成改造交接文档（方案 A：Next.js `after()`）

> **日期**：2026-08-01
> **目标**：把 `/api/generate` 从同步改为异步，解决线上"生成超时"问题
> **新会话接手**：先读本文件 + `docs/handoff.md`，即可开始实施
> **方案已与用户确认**：方案 A（`after()` 后台执行），不选 B（Vercel Workflow）/ C（分段函数）

---

## 1. 背景：为什么要改

### 现状（同步架构）
- `/api/generate`（`src/app/api/generate/route.ts`）：一个请求里同步跑完 AI 两步（KIE text-to-image + 4 部位 image-to-image）+ 下载到 R2 + 写库，**然后才返回响应**。
- AI 实测耗时约 **250 秒**（前端假进度 `STAGE2_END_SEC = 250` 印证）。
- 已设 `export const maxDuration = 300`（Vercel 函数上限）。

### 症状（线上 tattooivis.ink 实测）
- `generate` 请求约 **102 秒** 时前端报 `net::ERR_CONNECTION_CLOSED`。
- 但 **KIE 后台任务成功 + 数据库有结果**（history 页能看到）。

### 根因
**Vercel 的网关/代理层在"函数超过 ~100 秒还没开始返回响应"时，主动关闭客户端连接**（`ERR_CONNECTION_CLOSED`）。函数本身没被立即杀，继续跑到 `maxDuration`（300s）把 AI 跑完、写库——但前端那条 HTTP 连接已经断了，收不到最终响应。

**`maxDuration=300` 救不了**，因为瓶颈是**网关连接超时（~100s）**，不是函数执行超时。

### 结论
同步架构在 Vercel 上**注定无解**（生成要 ~250s，远超 ~100s 连接上限）。必须改异步。

---

## 2. 方案 A：`after()` 后台执行 + 前端轮询

### 核心思路
```
现在（同步）：generate → 死等 AI 250s → 网关 100s 断连接 → 前端无响应
改异步后：    generate → 立即返回 projectId（<1s，连接不断）
             after() 在响应后后台跑 AI（~250s，受 maxDuration 300s 保护）
             前端轮询 status → 完成 → 显示结果
```

### 为什么 after() 够用
- `after()` 是 Next.js 15.3+ 的 API（`import { after } from 'next/server'`），在响应发送**后**执行后台任务，任务可跑到函数 `maxDuration`。
- AI 实测 ~250s < maxDuration 300s → `after()` 能跑完。
- 不需要 Vercel Workflow（WDK）的分段/durable 能力（那是 AI >300s 或要崩溃恢复才需要，目前用不上）。

---

## 3. 数据模型（基本不改）

复用现有 `projects` + `generations` 表（`supabase/migrations/0001_init.sql`），**无需新增字段**：

- `projects.status`：`pending` / `processing` / `completed` / `failed`（已有）
- `projects.error_message`：失败原因（已有）
- `generations`：4 条部位记录，含 `tattoo_image_key`（Step1 共享）/ `result_image_key` / `result_image_url` / `status`（已有）

轮询返回的数据全部能从这两张表查出来。

> 可选小优化：给 `projects` 加一个 `tattoo_design_url` 字段存 Step1 结果 URL，省得轮询时从 generations 推导。但非必须——generations[0].tattoo_image_key 经 `getPublicUrl()` 即可还原。

---

## 4. 后端改动

### 4.1 改造 `src/app/api/generate/route.ts`

**POST 流程改为**：验证 → 扣 credits → 创建 project（`processing`）→ **立即返回 `{ projectId }`** → `after()` 启动后台 AI。

```ts
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import { getCredits, deductCredits, createProject } from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { runGeneration } from '@/server/ai/run-generation'  // 新建，见 4.3

export const maxDuration = 300  // 保留

export async function POST(req: Request) {
  /* 1. Clerk 鉴权 + ensureUser + 解析 body + 校验 prompt（复用现有逻辑） */

  /* 2. 余额检查（402）+ 扣 credits（原子 RPC）—— 复用现有 getCredits/deductCredits */

  /* 3. createProject(status='processing') —— 复用现有 */

  /* 4. 立即返回 projectId，after() 后台跑 AI */
  after(() =>
    runGeneration({
      projectId: project.id,
      userId,
      bodyPhotoUrl,
      prompt,
    })
  )

  return NextResponse.json({ projectId: project.id })
}
```

**关键**：把现有 POST 里"Step 7 执行 AI 流程"那一大段**整体抽到** `runGeneration()`（见 4.3）。POST 只保留前置（鉴权/扣费/建 project）+ 立即返回。

### 4.2 新建 `src/app/api/generate/status/route.ts`（轮询接口）

```ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectWithGenerations } from '@/server/db/queries'  // 新增查询，见 4.4
import { getPublicUrl } from '@/lib/r2'

export const dynamic = 'force-dynamic'

/** GET /api/generate/status?id=<projectId> —— 前端轮询生成进度 */
export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const project = await getProjectWithGenerations(id)
  if (!project || project.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 从 generations[0].tattoo_image_key 还原 Step1 设计图 URL
  const tattooDesignUrl = project.generations[0]?.tattoo_image_key
    ? getPublicUrl(project.generations[0].tattoo_image_key)
    : null

  return NextResponse.json({
    status: project.status,            // processing / completed / failed
    tattooDesignUrl,                    // completed 时有值
    images: project.generations.map((g) => ({
      bodyPart: g.body_part,
      status: g.status,
      url: g.result_image_url,
    })),
    error: project.error_message,       // failed 时有值
  })
}
```

### 4.3 新建 `src/server/ai/run-generation.ts`（后台 AI 流程）

把现有 generate route 的 Step 7 整段搬过来，包一层 try/catch（任何失败都标 `failed` + 退款）：

```ts
import { generateTattooDesign } from './generate-tattoo'
import { applyTattooToBody } from './apply-to-body'
import { recordGenerations, updateProjectStatus, refundCredits } from '@/server/db/queries'

/**
 * 后台执行生成（由 /api/generate 的 after() 触发）。
 * 任何失败都标 project=failed + 退款，绝不抛出（after() 的错误无法返回客户端）。
 */
export async function runGeneration({
  projectId,
  userId,
  bodyPhotoUrl,
  prompt,
}: {
  projectId: string
  userId: string
  bodyPhotoUrl: string
  prompt: string
}): Promise<void> {
  try {
    // Step 1：生成纹身图案
    const tattoo = await generateTattooDesign({ prompt, userId, projectId })

    // Step 2：4 部位并发融合
    const fusionResults = await applyTattooToBody({
      bodyPhotoUrl,
      tattooDesignUrl: tattoo.r2Url,
      userId,
      projectId,
    })

    // 入库 4 条 generations
    await recordGenerations(
      projectId,
      userId,
      tattoo.r2Key,
      fusionResults.map((r) => ({
        bodyPart: r.bodyPart,
        status: r.status,
        resultImageKey: r.image?.r2Key ?? null,
        resultImageUrl: r.image?.r2Url ?? null,
      }))
    )

    // 判断整体状态
    const successCount = fusionResults.filter((r) => r.status === 'completed').length
    if (successCount === 0) {
      await updateProjectStatus(projectId, 'failed', 'All 4 body parts failed')
      await safeRefund(userId)
    } else {
      await updateProjectStatus(projectId, 'completed')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[runGeneration] failed:', msg)
    await updateProjectStatus(projectId, 'failed', msg)
    await safeRefund(userId)
  }
}

async function safeRefund(userId: string): Promise<void> {
  try {
    await refundCredits(userId, 1 /* CREDITS_PER_GENERATION */)
  } catch (e) {
    console.error('[runGeneration] refund FAILED — credits not returned:', e)
  }
}
```

### 4.4 新增 `getProjectWithGenerations` 查询（`src/server/db/queries.ts`）

```ts
/** 查单个 project + 它的 generations（轮询用）。参考现有 listProjects 的嵌套 select。 */
export async function getProjectWithGenerations(projectId: string) {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, generations(*)')
    .eq('id', projectId)
    .maybeSingle()
  if (error) throw error
  return data
}
```

---

## 5. 前端改动：`src/hooks/use-generation.ts`

把 `generate()` 从"fetch + 等响应"改成"fetch 拿 projectId + 轮询 status"：

```ts
const generate = useCallback(async () => {
  // ... 前置校验 + 启动假进度计时器（保留现有 computeStage 假进度，UX 不变）

  try {
    // 1. 触发生成，立即拿 projectId
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bodyPhotoKey: current.photoKey,
        bodyPhotoUrl: current.photoUrl,
        prompt: current.prompt.trim(),
      }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
    const { projectId } = await res.json()

    // 2. 轮询 status（每 3 秒）
    await pollStatus(projectId)  // 见下
  } catch (e) {
    // 错误处理（保留现有逻辑）
  }
}, [...])

// 轮询：到 completed/completed 显示结果，failed 显示错误，5.5 分钟超时兜底
const pollStatus = (projectId: string) => new Promise((resolve, reject) => {
  const TIMEOUT_MS = 5.5 * 60 * 1000   // 超过 maxDuration(5min) 一点
  const INTERVAL_MS = 3000
  const start = Date.now()

  const timer = setInterval(async () => {
    // 超时兜底
    if (Date.now() - start > TIMEOUT_MS) {
      clearInterval(timer)
      reject(new Error('Generation timed out. Check /history later.'))
      return
    }
    try {
      const s = await fetch(`/api/generate/status?id=${projectId}`).then((r) => r.json())
      if (s.status === 'completed') {
        clearInterval(timer)
        clearTimers()
        setState((prev) => ({ ...prev, status: 'completed', result: { projectId, ...s }, generateProgress: 100 }))
        resolve(s)
      } else if (s.status === 'failed') {
        clearInterval(timer)
        clearTimers()
        setState((prev) => ({ ...prev, status: 'error', error: s.error || 'Generation failed', refunded: true }))
        reject(new Error(s.error))
      }
      // processing → 继续轮询（假进度计时器继续推 UI）
    } catch (e) {
      // 单次轮询网络错误不致命，继续
    }
  }, INTERVAL_MS)
})
```

**注意**：
- 假进度计时器（`computeStage`）**保留**——给用户视觉反馈，UX 不变。
- `GenerateResponse` 类型（`src/types/index.ts`）改为匹配新的轮询返回结构（`projectId` 在 generate 响应，`tattooDesignUrl`/`images` 在 status 响应）。
- `reset()` / 卸载时要 `clearInterval` 轮询定时器（加进现有 `clearTimers`）。

---

## 6. 错误处理与退款（重点）

| 场景 | 处理 |
|---|---|
| AI 流程成功（≥1 张） | `project=completed` |
| 4 张全失败 | `project=failed` + 退款 |
| AI 抛错（KIE/网络） | `runGeneration` 的 catch → `project=failed` + 退款 |
| `after()` 进程被 maxDuration 杀（AI >300s，偶发） | project 卡 `processing` → **前端 5.5min 轮询超时提示失败**（credits 暂不退，MVP 接受；后续可加 cron 清理） |
| 前端轮询超时 | 提示"生成超时，稍后去 /history 查看"（project 可能还在后台跑完） |

> **比同步架构改善**：同步时进程被杀 credits 扣了不退；异步有 `runGeneration` 的 try/catch，**大部分失败能可靠退款**。只剩"after() 进程被杀"这一极端情况不退（MVP 接受）。

---

## 7. 实施步骤（新会话建议顺序）

每步独立 commit（中文 message + `Co-Authored-By: Claude <noreply@anthropic.com>`）：

1. **抽 `runGeneration`**：新建 `src/server/ai/run-generation.ts`，把现有 generate route 的 Step 7 整段搬过来 + try/catch + 退款。此时不动 generate route。
2. **加 `getProjectWithGenerations` 查询**：`src/server/db/queries.ts`。
3. **改造 generate route**：前置逻辑保留，Step 7 换成 `after(() => runGeneration(...))`，立即返回 `{ projectId }`。
4. **新建 status route**：`src/app/api/generate/status/route.ts`。
5. **改 `useGeneration`**：fetch 拿 projectId + 轮询；更新 `GenerateResponse` 类型；`clearTimers` 清轮询。
6. **`npm run build && npm run lint`** 全过。
7. **本地测试**：`npm run dev` + 真实 KIE 生成一次，确认轮询到 completed。
8. **commit + push** → Vercel 自动部署 → tattooivis.ink 实测：generate 不再 102s 断、约 250s 出图。

---

## 8. 验证清单（实施完对照）

- [ ] `npm run build` + `npm run lint` 全过
- [ ] 本地：generate 立即返回 projectId（<1s），前端轮询 ~250s 后显示 4 张图
- [ ] 本地：模拟失败（断 KIE key）→ project=failed + credits 退还
- [ ] 生产 tattooivis.ink：generate **不再 `ERR_CONNECTION_CLOSED`**，约 250s 出图
- [ ] 生产：生成中刷新/关页面，再回来能在 /history 看到结果（异步的额外好处）
- [ ] 生产：4 张全失败时 credits 退还

---

## 9. 注意事项与风险

1. **`after()` 来源**：`import { after } from 'next/server'`。项目用 Next.js 16.2.10，`after()` 已 stable（15.3+）。实施时确认 import 路径无误。
2. **`after()` 的 callback 错误不会返回客户端**（响应已发）——所以 `runGeneration` 必须**自己 try/catch + 更新 project status + 退款**，不能让错误默默吞掉。
3. **`after()` 受 `maxDuration` 限制（300s）**：AI 偶发 >300s 时，进程被杀，project 卡 `processing`。前端 5.5min 轮询超时兜底。长期解法是升级方案 B（Vercel Workflow），MVP 不做。
4. **并发请求**：现在没做"同一用户 30s 内只能 1 次"的限制（handoff §10 已知问题）。异步后更该加（防刷 credits）——但不在本次范围，可在 status/generate 加检查。
5. **前端轮询要 cleanup**：组件卸载 / `reset()` 时 `clearInterval`，否则内存泄漏。加进现有 `clearTimers`。
6. **假进度保留**：`computeStage` 基于 elapsed 推进度，UX 不变。轮询只决定何时切到 completed/failed。

---

## 10. 相关文件速查

| 主题 | 文件 |
|---|---|
| 现有同步 generate route | `src/app/api/generate/route.ts` |
| 前端状态机（要改轮询） | `src/hooks/use-generation.ts` |
| AI Step 1（纹身图） | `src/server/ai/generate-tattoo.ts` |
| AI Step 2（4 部位融合） | `src/server/ai/apply-to-body.ts` |
| KIE 客户端 | `src/server/ai/kie-client.ts` |
| DB 查询（含 listProjects 参考） | `src/server/db/queries.ts` |
| R2 URL 还原 | `src/lib/r2.ts` → `getPublicUrl()` |
| API 响应类型 | `src/types/index.ts` |
| 项目总交接 | `docs/handoff.md` |
| 数据库 schema | `supabase/migrations/0001_init.sql` |

---

## 11. 给新会话的开场建议

1. 读本文件 + `docs/handoff.md`。
2. `npm run build` 确认当前状态干净。
3. 读 `src/app/api/generate/route.ts` + `src/hooks/use-generation.ts` + `src/server/ai/apply-to-body.ts` 理解现有同步流程。
4. 按 §7 实施步骤逐 task 做（建议走 superpowers 的 writing-plans → subagent-driven-development 流程）。
5. 第 3 步改造 generate route 时，**先本地 `npm run dev` 测一次**（确认 after() 在本地 work），再 push 到 Vercel 测生产。
