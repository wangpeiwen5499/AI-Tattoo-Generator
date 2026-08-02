# 异步生成改造（方案 A：Next.js `after()`）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐 task 执行。步骤用 `- [ ]` 复选框跟踪。
>
> **依据**：`docs/handoff-async-generation.md`（方案已与用户确认）。本计划把该文档的伪代码换成基于真实代码的可执行步骤。

**Goal:** 把 `/api/generate` 从"同步死等 AI ~250s"改为"立即返回 projectId + `after()` 后台跑 AI + 前端轮询"，解决线上 tattoivis.ink 约 102s 网关断连（`ERR_CONNECTION_CLOSED`）。

**Architecture:** 后端把 generate route 的 Step 7（AI 两步流程）整体抽到 `runGeneration()`，POST 改为前置（鉴权/扣费/createProject）→ `after(() => runGeneration(...))` → 立即返回 `{ projectId }`；新增 `/api/generate/status` 轮询接口从 `projects`+`generations` 查进度。前端 `useGeneration` 改为"fetch 拿 projectId + `setTimeout` 链式轮询 status"，假进度计时器保留（UX 不变）。

**Tech Stack:** Next.js 16.2.10（`after()` 自 15.3 stable，已用 context7 确认签名 `after(callback: () => void | Promise<void>)`，支持 async 回调，受 `maxDuration` 控制）、React 19、Supabase（service_role）、Cloudflare R2、Clerk。

## Global Constraints

- 所有回答与 **commit message 用中文**（`CLAUDE.md`）；每个 commit 末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **不加新数据库字段**：复用现有 `projects` + `generations` 表（`supabase/migrations/0001_init.sql`）。
- **保留 `export const maxDuration = 300`**：`after()` 后台任务受它保护。
- **`after()` 的回调错误无法返回客户端**（响应已发）→ `runGeneration` 必须自己 try/catch + 更新 project status + 退款，绝不抛出。
- **项目无测试框架**（package.json 无 test script / vitest / jest）：验证用 `npm run lint` + `npm run build` + 手动 DevTools，**不强加 unit test**，遵循既有 codebase 模式。
- **不碰** `getSupabaseAdmin()` 的 lazy 模式、不在模块顶层 `export const supabaseAdmin = ...`（handoff §4 第 5 项已知坑）。
- `CREDITS_PER_GENERATION = 1`（`src/lib/constants.ts` 已确认）。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/server/ai/run-generation.ts` | **新建** | 后台 AI 流程（Step1 + Step2 + 入库 + 状态/退款），自带 try/catch |
| `src/server/db/queries.ts` | **修改**（追加 1 个函数） | 加 `getProjectWithGenerations(projectId)`（轮询用） |
| `src/app/api/generate/route.ts` | **修改** | Step 1-6 保留；Step 7 换成 `after(() => runGeneration(...))`；立即返回 `{ projectId }` |
| `src/app/api/generate/status/route.ts` | **新建** | `GET /api/generate/status?id=<projectId>` 轮询接口 |
| `src/types/index.ts` | **修改**（追加 2 个类型） | `GenerateTriggerResponse`、`GenerationStatusResponse`（保留 `GenerateResponse` 不变） |
| `src/hooks/use-generation.ts` | **修改** | fetch 拿 projectId + `pollStatus` 链式轮询；`clearTimers` 加清轮询定时器；去掉旧的 15min `timeoutRef` |
| `src/components/tattoo-generator.tsx` | **不改** | 仅经 `gen.result.*` 消费，result 形状不变 |
| `src/components/generation-results.tsx` | **不改** | `tattooDesignUrl`/`images` 形状不变 |

---

## Task 1: 抽 `runGeneration`（后台 AI 流程）

**Files:**
- Create: `src/server/ai/run-generation.ts`

**Interfaces:**
- Consumes: `generateTattooDesign({ prompt, userId, projectId })` → `TattooDesign{r2Key,r2Url}`（来自 `./generate-tattoo`）；`applyTattooToBody({ bodyPhotoUrl, tattooDesignUrl, userId, projectId })` → `BodyFusionResults`（来自 `./apply-to-body`，单部位失败落 result 不抛错）；`recordGenerations(projectId, userId, tattooImageKey, results[])`、`updateProjectStatus(projectId, 'completed'|'failed', msg?)`、`refundCredits(userId, amount)`（来自 `@/server/db/queries`）。
- Produces: `runGeneration(input)` —— 被 generate route 的 `after()` 调用，返回 `Promise<void>`，绝不抛错。

- [ ] **Step 1: 新建 `src/server/ai/run-generation.ts`，写入完整内容**

```ts
/**
 * 后台执行生成（由 /api/generate 的 after() 在响应发出后触发）。
 *
 * 关键约束：调用方（after 回调）的错误无法再通过 HTTP 返回客户端，
 * 所以本函数必须自己 try/catch —— 任何失败都把 project 标 failed 并退款，
 * 绝不让错误默默吞掉、也绝不向外抛出。
 *
 * 退款策略（与原同步 route 一致）：
 *   - Step 1 抛错 / 未预期异常 → project=failed + 全额退款
 *   - 4 部位全失败              → project=failed + 全额退款
 *   - ≥1 张成功                 → project=completed（不退款，用户已拿到价值）
 */
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { generateTattooDesign } from './generate-tattoo'
import { applyTattooToBody } from './apply-to-body'
import {
  recordGenerations,
  updateProjectStatus,
  refundCredits,
} from '@/server/db/queries'

export interface RunGenerationInput {
  projectId: string
  userId: string
  bodyPhotoUrl: string
  prompt: string
}

export async function runGeneration(input: RunGenerationInput): Promise<void> {
  const { projectId, userId, bodyPhotoUrl, prompt } = input
  try {
    // Step 1：生成纹身图案
    const tattoo = await generateTattooDesign({ prompt, userId, projectId })

    // Step 2：4 部位并发融合（单部位失败落 result，不抛错）
    const fusionResults = await applyTattooToBody({
      bodyPhotoUrl,
      tattooDesignUrl: tattoo.r2Url,
      userId,
      projectId,
    })

    // 入库 4 条 generations（共享 Step 1 的 tattoo_image_key）
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

/** 安全退款：退款本身失败也不抛错，只记日志（避免吞掉上层错误） */
async function safeRefund(userId: string): Promise<void> {
  try {
    await refundCredits(userId, CREDITS_PER_GENERATION)
  } catch (e) {
    console.error('[runGeneration] refund FAILED — credits not returned:', e)
  }
}
```

- [ ] **Step 2: 跑 lint 确认类型/语法正确**

Run: `npm run lint`
Expected: 不报与 `run-generation.ts` 相关的错误（新文件暂未被引用，不会影响其它文件）。

- [ ] **Step 3: Commit**

```bash
git add src/server/ai/run-generation.ts
git commit -m "feat: 抽出 runGeneration 后台 AI 流程（含 try/catch + 退款）

为异步改造做准备：把 /api/generate 的 Step 7（Step1 纹身图 + Step2 四部位融合
+ 入库 + 状态判定）整体抽到独立模块。after() 回调的错误无法返回客户端，
所以本函数自带 try/catch：任何失败都标 project=failed 并退款，绝不抛出。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 加 `getProjectWithGenerations` 查询

**Files:**
- Modify: `src/server/db/queries.ts`（在文件末尾 `listProjects` 之后追加）

**Interfaces:**
- Consumes: `getSupabaseAdmin()`（`@/lib/supabase/server`）、`ProjectWithGenerations` 类型（`@/types`，已存在）。
- Produces: `getProjectWithGenerations(projectId) → Promise<ProjectWithGenerations | null>` —— 被 status route 调用；不带 user_id 过滤（归属校验由 status route 做）。

- [ ] **Step 1: 在 `src/server/db/queries.ts` 末尾追加**

```ts
/**
 * 查单个 project + 它的 generations（/api/generate/status 轮询用）。
 * 参考 listProjects 的嵌套 select '*, generations(*)'（自动按 project_id 外键关联）。
 * 不带 user_id 过滤 —— 归属校验由调用方（status route）负责。
 */
export async function getProjectWithGenerations(
  projectId: string
): Promise<ProjectWithGenerations | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, generations(*)')
    .eq('id', projectId)
    .maybeSingle()

  if (error) throw error
  return data as ProjectWithGenerations | null
}
```

> 注：`ProjectWithGenerations` 已在 `queries.ts` 顶部 import（`import type { GenerationRow, ProjectRow, ProjectWithGenerations, UserRow } from '@/types'`，见文件第 2 行），无需新增 import。

- [ ] **Step 2: 跑 lint 确认类型正确**

Run: `npm run lint`
Expected: 无新错误。

- [ ] **Step 3: Commit**

```bash
git add src/server/db/queries.ts
git commit -m "feat: 加 getProjectWithGenerations 查询（轮询接口用）

复用 listProjects 的嵌套 select 模式，按 projectId 查单条 project + generations。
不带 user_id 过滤，归属校验交给 status route。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 改造 generate route（`after()` + 立即返回 projectId）

**Files:**
- Modify: `src/app/api/generate/route.ts`

**Interfaces:**
- Consumes: `runGeneration`（Task 1）、`after`（`next/server`）。
- Produces: `POST /api/generate` 现在响应 `200 { projectId: string }`（<1s 返回，连接不断）。前置逻辑（鉴权/ensureUser/解析/余额/扣费/createProject）原样保留。

- [ ] **Step 1: 替换 import 块（文件第 1-14 行）**

把原 import 块：
```ts
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import {
  getCredits,
  deductCredits,
  refundCredits,
  createProject,
  recordGenerations,
  updateProjectStatus,
} from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { generateTattooDesign } from '@/server/ai/generate-tattoo'
import { applyTattooToBody } from '@/server/ai/apply-to-body'
```
替换为：
```ts
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import {
  getCredits,
  deductCredits,
  refundCredits,
  createProject,
} from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { runGeneration } from '@/server/ai/run-generation'
```
（删掉不再用的 `recordGenerations`、`updateProjectStatus`、`generateTattooDesign`、`applyTattooToBody`；新增 `after`、`runGeneration`；保留 `refundCredits`，因 `safeRefund` 仍要用。）

- [ ] **Step 2: 更新文件头注释的"响应"说明**

把原注释块里：
```
 * 响应：
 *   200 { projectId, tattooDesignUrl, images: [{bodyPart, status, url}] }
```
改为：
```
 * 响应：
 *   200 { projectId }                  立即返回，AI 在 after() 后台跑（异步）
 *   400 校验失败
 *   401 未登录
 *   402 credits 不足
 *   500 ensureUser / 扣费 / createProject 失败（已退款）
 *
 * 异步说明：AI 流程（Step1 + Step2 + 入库 + 退款）在 after() 里执行，
 * 进度/结果由前端轮询 GET /api/generate/status?id=<projectId> 获取。
```

- [ ] **Step 3: 替换"Step 7 整段"为 `after()` + 立即返回**

把原 POST 里从 `/* 7. 执行 AI 流程（Step 1 + Step 2） */` 开始、一直到函数末尾 `}` 的整段（即原 Step 7 try/catch + 末尾的 `safeRefund` 之前），**整段替换**为：

```ts
  /* 7. 立即返回 projectId，after() 在响应发出后后台跑 AI（异步） */
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

> **关键**：Step 1-6（鉴权 / ensureUser / 解析 body / 余额检查 / 扣 credits / createProject）**原样保留不动**；createProject 失败时的 catch 里的 `safeRefund` + `return 500` 也保留。只替换 Step 7 那一大段。

- [ ] **Step 4: 确认文件末尾的 `safeRefund` helper 仍在**

文件末尾原本就有：
```ts
/** 安全退款：即使退款本身失败也不抛错，只记日志（避免吞掉原始错误） */
async function safeRefund(userId: string, amount: number): Promise<void> {
  try {
    await refundCredits(userId, amount)
  } catch (e) {
    console.error('[generate] safeRefund FAILED — credits not returned to user:', e)
  }
}
```
**保留不动**（createProject 失败时仍要退款；签名带 `amount` 与 Task 1 的 `safeRefund(userId)` 不同，两者在不同文件互不冲突）。

- [ ] **Step 5: 跑 lint + build 确认类型正确（此时前端尚未改，build 仍应通过）**

Run: `npm run lint && npm run build`
Expected: 无新错误。`/api/generate` 现在返回 `{ projectId }`，旧前端虽然拿到 projectId 但 `.images` 访问会 undefined —— 这是预期的（前端在 Task 5 改），不影响 build。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: /api/generate 改异步（after() + 立即返回 projectId）

Step 1-6（鉴权/ensureUser/余额/扣费/createProject）保留不动；
Step 7 整段抽到 runGeneration，改用 after() 在响应发出后后台执行。
POST 立即返回 { projectId }（<1s），破解 Vercel 网关 ~100s 连接超时。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 新建 status 轮询接口

**Files:**
- Create: `src/app/api/generate/status/route.ts`

**Interfaces:**
- Consumes: `auth()`（`@clerk/nextjs/server`）、`getProjectWithGenerations`（Task 2）、`getPublicUrl(key)`（`@/lib/r2`，已存在）、`BODY_PARTS` + `BodyPart`（`@/lib/constants`）。
- Produces: `GET /api/generate/status?id=<projectId>` → `200 { status, tattooDesignUrl, images: GenerateImage[], error }`；`401/400/404`。

- [ ] **Step 1: 新建 `src/app/api/generate/status/route.ts`，写入完整内容**

```ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectWithGenerations } from '@/server/db/queries'
import { getPublicUrl } from '@/lib/r2'
import { BODY_PARTS, type BodyPart } from '@/lib/constants'
import type { GenerateImage } from '@/types'

// 轮询接口必须每次都打到动态函数，禁用一切静态化/缓存
export const dynamic = 'force-dynamic'

/**
 * GET /api/generate/status?id=<projectId>
 * 前端轮询生成进度。响应：
 *   {
 *     status: 'processing' | 'completed' | 'failed',
 *     tattooDesignUrl: string | null,   // Step1 成功后从 generations[0].tattoo_image_key 还原
 *     images: [{ bodyPart, status, url }],  // 按 BODY_PARTS 原顺序
 *     error: string | null              // failed 时有值
 *   }
 *
 * 状态码：200 正常；401 未登录；400 缺 id；404 project 不存在或不属于该用户。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const project = await getProjectWithGenerations(id)
  if (!project || project.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Step1 纹身图 URL 从 generations[0].tattoo_image_key 还原
  // （Step1 失败 → runGeneration 进 catch、未 recordGenerations → generations 为空 → null）
  const tattooImageKey = project.generations[0]?.tattoo_image_key ?? null
  const tattooDesignUrl = tattooImageKey ? getPublicUrl(tattooImageKey) : null

  // generations 按 BODY_PARTS 原顺序排列，保证前端 2x2 网格稳定
  const sortedGenerations = [...project.generations].sort(
    (a, b) =>
      BODY_PARTS.indexOf(a.body_part as BodyPart) -
      BODY_PARTS.indexOf(b.body_part as BodyPart)
  )

  const images: GenerateImage[] = sortedGenerations.map((g) => ({
    bodyPart: g.body_part as BodyPart,
    status: g.status as 'completed' | 'failed',
    url: g.result_image_url,
  }))

  return NextResponse.json({
    status: project.status,
    tattooDesignUrl,
    images,
    error: project.error_message,
  })
}
```

> 说明：DB 行 `body_part: string`、`status: GenerationStatus`（含 `'pending'`），但运行时只会是 `BODY_PARTS` 里的值与 `completed/failed`（recordGenerations 只写这两个），故用 `as` 断言收窄类型。

- [ ] **Step 2: 跑 lint 确认类型正确**

Run: `npm run lint`
Expected: 无新错误。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/status/route.ts
git commit -m "feat: 加 GET /api/generate/status 轮询接口

前端轮询生成进度用。鉴权 + 归属校验后，从 projects+generations 查状态；
tattooDesignUrl 从 generations[0].tattoo_image_key 经 getPublicUrl 还原；
images 按 BODY_PARTS 原顺序排列，保证 2x2 网格稳定。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 改前端类型 + `useGeneration`（轮询）

**Files:**
- Modify: `src/types/index.ts`（追加 2 个类型）
- Modify: `src/hooks/use-generation.ts`（fetch 拿 projectId + `pollStatus` 链式轮询）

**Interfaces:**
- Consumes: `/api/generate` 现返回 `{ projectId }`；`/api/generate/status` 返回 `{ status, tattooDesignUrl, images, error }`（Task 3、4）。
- Produces: `useGeneration` 的对外 API 不变（`generate/reset/...` + `state.result: GenerateResponse | null` 形状不变），故 `tattoo-generator.tsx` / `generation-results.tsx` **无需改动**。

- [ ] **Step 1: 在 `src/types/index.ts` 追加两个类型（保留 `GenerateResponse` 不变）**

在 `GenerateResponse` 接口之后追加：
```ts
/** POST /api/generate 响应（异步：立即返回，只给 projectId） */
export interface GenerateTriggerResponse {
  projectId: string
}

/** GET /api/generate/status 响应（前端轮询） */
export interface GenerationStatusResponse {
  status: 'processing' | 'completed' | 'failed'
  /** Step1 成功后从 generations[0].tattoo_image_key 还原；Step1 失败时为 null */
  tattooDesignUrl: string | null
  images: GenerateImage[]
  /** failed 时有值（project.error_message） */
  error?: string | null
}
```
> `GenerateResponse`（`{ projectId, tattooDesignUrl, images, error? }`）保持原样 —— 它仍是前端最终 `result` 的类型，供 `GenerationResults` 组件消费。

- [ ] **Step 2: 改 `src/hooks/use-generation.ts` —— import 块**

把原：
```ts
import type {
  GenerateResponse,
  UploadUrlResponse,
} from '@/types'
```
改为：
```ts
import type {
  GenerateResponse,
  GenerateTriggerResponse,
  GenerationStatusResponse,
  UploadUrlResponse,
} from '@/types'
```

- [ ] **Step 3: 加轮询常量（放在 `PROGRESS_CAP` 之后）**

在 `const PROGRESS_CAP = 95` 之后追加：
```ts
/** 轮询参数 */
const POLL_INTERVAL_MS = 3000          // 每 3s 轮询一次
const POLL_TIMEOUT_MS = 5.5 * 60 * 1000 // 略超 maxDuration(5min)，兜底防永久轮询
```

- [ ] **Step 4: 替换 ref 声明（去 `timeoutRef`，加 `pollTimerRef`）**

把原：
```ts
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedStartRef = useRef<number>(0)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
```
改为：
```ts
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedStartRef = useRef<number>(0)
```

- [ ] **Step 5: 替换 `clearTimers`（清 `progressTimerRef` + `pollTimerRef`，去掉 `timeoutRef`）**

把原：
```ts
  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])
```
改为：
```ts
  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])
```

- [ ] **Step 6: 在 `uploadPhoto` 之后、`generate` 之前，新增 `pollStatus`**

```ts
  /**
   * 轮询 /api/generate/status 直到 completed/failed 或超时。
   * - resolve 返回最终状态对象（completed 或 failed 都 resolve，由 generate 判定）
   * - reject 表示真错误：超时 / reset 主动取消（AbortError）
   * 单次轮询的网络错误不致命，排下一次重试。
   * 用 setTimeout 链（而非 setInterval）避免上一次 fetch 慢导致请求堆积。
   */
  const pollStatus = useCallback(
    (projectId: string): Promise<GenerationStatusResponse> => {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now()

        const tick = async () => {
          // 超时兜底
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            reject(new Error('Generation timed out. Check /history later.'))
            return
          }

          let data: GenerationStatusResponse
          try {
            const res = await fetch(`/api/generate/status?id=${projectId}`, {
              signal: abortRef.current?.signal,
            })
            data = (await res.json()) as GenerationStatusResponse
          } catch (e) {
            // reset()/卸载主动 abort → 终止轮询
            if (e instanceof DOMException && e.name === 'AbortError') {
              reject(e)
              return
            }
            // 单次网络错误 → 排下一次重试（不致命）
            pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
            return
          }

          if (data.status === 'completed' || data.status === 'failed') {
            resolve(data)
            return
          }
          // processing → 继续轮询
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
        }

        // 首次立即跑一次（不等 3s），让"刚触发"也能很快拿到 processing
        tick()
      })
    },
    []
  )
```

- [ ] **Step 7: 替换 `generate` 的"启动进度 + fetch"段**

把原 `generate` 里从 `// AbortController 15 分钟超时兜底` 那行开始、直到 `try { ... } catch ... }` 整个 try/catch 结束的部分：

原：
```ts
    // AbortController 15 分钟超时兜底
    abortRef.current = new AbortController()
    timeoutRef.current = setTimeout(() => abortRef.current?.abort(), 15 * 60 * 1000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyPhotoKey: current.photoKey,
          bodyPhotoUrl: current.photoUrl,
          prompt: current.prompt.trim(),
        }),
        signal: abortRef.current.signal,
      })

      let data: GenerateResponse
      try {
        data = await res.json()
      } catch {
        throw new Error('Invalid response from server')
      }

      // 4 张全失败的语义判定（后端在 allFailed 时返回 HTTP 500 + 完整 body）
      const allFailed =
        data.images.length > 0 && data.images.every((img) => img.status === 'failed')

      // allFailed 是业务结果（虽然 HTTP 500），不当作服务器错误，走退款路径
      if ((!res.ok && !allFailed) || !data.projectId) {
        throw new Error(data.error || `Generation failed (HTTP ${res.status})`)
      }

      clearTimers()
      setState((s) => ({
        ...s,
        status: allFailed ? 'error' : 'completed',
        generateProgress: 100,
        stageLabel: allFailed ? 'All parts failed' : 'Done!',
        result: data,
        refunded: allFailed,
        error: allFailed ? data.error || 'All 4 body parts failed' : null,
      }))
    } catch (e) {
      clearTimers()
      // 如果状态已被外部 reset() 改为 idle，说明用户主动取消了，
      // 此时不应再覆盖状态；同时静默吞掉 AbortError，不向调用方抛出。
      if (stateRef.current.status === 'idle') return
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      const msg = aborted
        ? 'Generation timed out after 15 minutes. Please try again.'
        : e instanceof Error
          ? e.message
          : String(e)
      setState((s) => ({
        ...s,
        status: 'error',
        stageLabel: 'Failed',
        error: msg,
      }))
      throw new Error(msg)
    }
  }, [clearTimers])
```

替换为：
```ts
    abortRef.current = new AbortController()

    try {
      // 1. 触发生成，立即拿 projectId（后端 after() 后台跑 AI）
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyPhotoKey: current.photoKey,
          bodyPhotoUrl: current.photoUrl,
          prompt: current.prompt.trim(),
        }),
        signal: abortRef.current.signal,
      })

      let trigger: GenerateTriggerResponse
      try {
        trigger = (await res.json()) as GenerateTriggerResponse
      } catch {
        throw new Error('Invalid response from server')
      }

      if (!res.ok || !trigger.projectId) {
        const errBody = trigger as unknown as { error?: string }
        throw new Error(errBody.error || `Generation failed (HTTP ${res.status})`)
      }

      // 2. 轮询 status 直到 completed/failed
      const data = await pollStatus(trigger.projectId)

      clearTimers()
      const allFailed = data.status === 'failed'
      // Step1 失败时后端 project=failed 且 generations 为空 → tattooDesignUrl=null
      // 此时 result 保持 null，走纯 error 路径（与原同步行为一致，避免渲染 broken img）
      const hasDesign = !!data.tattooDesignUrl
      setState((s) => ({
        ...s,
        status: allFailed ? 'error' : 'completed',
        generateProgress: 100,
        stageLabel: allFailed ? 'All parts failed' : 'Done!',
        result: hasDesign
          ? {
              projectId: trigger.projectId,
              tattooDesignUrl: data.tattooDesignUrl as string,
              images: data.images,
              error: data.error ?? undefined,
            }
          : null,
        refunded: allFailed,
        error: allFailed ? data.error || 'All 4 body parts failed' : null,
      }))
    } catch (e) {
      clearTimers()
      // 如果状态已被外部 reset() 改为 idle，说明用户主动取消了，
      // 此时不应再覆盖状态；同时静默吞掉 AbortError，不向调用方抛出。
      if (stateRef.current.status === 'idle') return
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      const msg = aborted
        ? 'Generation canceled'
        : e instanceof Error
          ? e.message
          : String(e)
      setState((s) => ({
        ...s,
        status: 'error',
        stageLabel: 'Failed',
        error: msg,
      }))
      throw new Error(msg)
    }
  }, [clearTimers, pollStatus])
```

> 说明：① 去掉了 15min `timeoutRef` 兜底 —— 轮询自带 5.5min 超时（`POLL_TIMEOUT_MS`）；`abortRef` 仍保留，用于 `reset()`/卸载主动取消。② `generate` 的依赖数组从 `[clearTimers]` 改为 `[clearTimers, pollStatus]`。③ `uploadPhoto` / `reset` / `resetPrompt` / `clearPhoto` / `setPrompt` / 卸载 effect 都不动（它们用的 `clearTimers` 签名未变）。

- [ ] **Step 8: 跑 lint + build 确认全过**

Run: `npm run lint && npm run build`
Expected: 全过。重点检查：
- 无 `timeoutRef` 残留引用（grep 不到）。
- `GenerateResponse` 仍被 `GenState.result` 引用，未变成未使用 import。
- `react-hooks/exhaustive-deps` 对 `generate` 的 `[clearTimers, pollStatus]` 不报错。

- [ ] **Step 9: Commit**

```bash
git add src/types/index.ts src/hooks/use-generation.ts
git commit -m "feat: 前端改异步轮询（fetch 拿 projectId + 轮询 status）

- types: 加 GenerateTriggerResponse / GenerationStatusResponse，保留 GenerateResponse
- useGeneration: generate() 改为 POST 拿 projectId → pollStatus 链式轮询
  · 用 setTimeout 链（非 setInterval）避免请求堆积
  · 5.5min 超时兜底；reset/卸载经 abortRef 主动取消
  · 假进度计时器保留，UX 不变
  · failed 且无 tattooDesignUrl 时 result=null，走纯 error 路径
- 去掉旧的 15min timeoutRef，clearTimers 改清 pollTimerRef

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 全量 build + lint 验证（收口）

**Files:** 无（仅验证）

- [ ] **Step 1: 全量 lint + build**

Run: `npm run lint && npm run build`
Expected: 全过（仅允许已知的 Next.js 16 middleware 弃用警告，见 handoff §4 第 2 项）。

- [ ] **Step 2: grep 确认无残留同步代码引用**

Run: `git grep -n "timeoutRef" -- src/hooks/use-generation.ts`
Expected: 无输出（已全部移除）。

Run: `git grep -n "generateTattooDesign\|applyTattooToBody\|recordGenerations" -- src/app/api/generate/route.ts`
Expected: 无输出（generate route 已不再直接调 AI / 入库，全转给 runGeneration）。

- [ ] **Step 3: 若上面两步全过且无需补救改动，则无需额外 commit**；若 build 报错，回到对应 Task 修复后用 `fix:` 前缀补一个 commit。

---

## Task 7: 本地手动验证（需真实 KIE key + Clerk 登录态）

> 本 task 需要用户在本机执行（涉及真实 AI 调用，消耗 ~30 KIE credits ≈ $0.15）。Claude 完成代码改动后，把这一节交给用户跑。

- [ ] **Step 1: 启动 dev server**

Run: `npm run dev`（http://localhost:3000）

- [ ] **Step 2: 登录 → 上传照片 → 输入 prompt → Generate**

预期（异步行为）：
- 点 Generate 后 **<1 秒** 进入"generating + 假进度"状态（不再卡在 fetch）。
- DevTools Network：`POST /api/generate` 几乎立即 `200 { projectId }`；随后每 3s 一次 `GET /api/generate/status?id=...`，期间响应 `{ status: 'processing', tattooDesignUrl: null, images: [] }`。
- 约 110s 后 status 响应里 `tattooDesignUrl` 开始有值（Step1 完成、Step2 进行中，generations 仍可能未入库）。
- 约 250s 后某次轮询返回 `{ status: 'completed', tattooDesignUrl, images: [4 条] }`，前端切到结果页显示纹身设计稿 + 4 部位图。

- [ ] **Step 3: 失败路径验证（可选，断 KIE key 模拟）**

把 `.env.local` 的 `KIE_API_KEY` 临时改错 → 重启 dev → Generate：
- 预期：轮询最终拿到 `{ status: 'failed', error: '...', tattooDesignUrl: null, images: [] }`。
- 前端走 error 路径（result=null，表单 + error toast），credits 应已退还（查 /api/credits 或 DB）。
- 验证后把 KIE_API_KEY 改回。

- [ ] **Step 4: 取消/刷新验证（异步额外好处）**

- 生成中点 "Start over"（reset）→ 轮询停止，状态回 idle，无报错。
- 生成中刷新页面 → 这次 generate 中断，但后台 `after()` 仍在跑；完成后去 `/history` 能看到结果（异步架构的红利）。

---

## Task 8: push → Vercel 自动部署 → 生产实测

> 在 Task 7 本地验证通过后执行。

- [ ] **Step 1: push 到 origin/main**

Run: `git push origin main`
（Vercel 自动部署）

- [ ] **Step 2: 生产 tattoivis.ink 实测**（对照 handoff-async-generation.md §8 验证清单）
- generate **不再 `ERR_CONNECTION_CLOSED`**，约 250s 出图。
- 生成中刷新/关页面，再回来能在 /history 看到结果。
- 4 张全失败时 credits 退还。

---

## 验证清单（实施完对照，来自 handoff-async-generation.md §8）

- [x 计划覆盖] `npm run lint` + `npm run build` 全过 → Task 6
- [x 计划覆盖] 本地：generate 立即返回 projectId（<1s），轮询 ~250s 后显示 4 张图 → Task 7 Step 2
- [x 计划覆盖] 本地：模拟失败（断 KIE key）→ project=failed + credits 退还 → Task 7 Step 3
- [x 计划覆盖] 生产：generate 不再 `ERR_CONNECTION_CLOSED`，约 250s 出图 → Task 8 Step 2
- [x 计划覆盖] 生产：生成中刷新/关页面，再回来能在 /history 看到结果 → Task 8 Step 2
- [x 计划覆盖] 生产：4 张全失败时 credits 退还 → Task 8 Step 2

---

## 风险与注意事项（来自 handoff-async-generation.md §9）

1. **`after()` callback 错误不返回客户端** → `runGeneration` 自带 try/catch + 退款（Task 1 已处理）。
2. **`after()` 受 maxDuration=300s 限制**：AI 偶发 >300s 时进程被杀，project 卡 `processing` → 前端 5.5min 轮询超时兜底（Task 5 `POLL_TIMEOUT_MS`），credits 暂不退（MVP 接受；长期升级方案 B Vercel Workflow）。
3. **并发请求未限制**（handoff §10 已知问题）—— 异步后更该加防刷，但不在本次范围。
4. **前端轮询要 cleanup**：`reset()`/卸载时 `clearTimers` 清 `pollTimerRef`（Task 5 Step 5 已处理）。
5. **假进度保留**：`computeStage` 不动，UX 不变。
