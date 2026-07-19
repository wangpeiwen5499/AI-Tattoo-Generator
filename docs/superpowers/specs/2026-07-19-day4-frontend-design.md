# Day 4 前端生成页设计

> **日期**：2026-07-19  
> **范围**：MVP Day 4 — 完整的前端生成体验（上传 → 生成 → 结果展示）  
> **依赖**：Day 3 已完成的 `/api/generate`（同步返回）+ `/api/upload-url`  
> **下一步**：实施计划由 writing-plans skill 生成

---

## 1. 背景与目标

Day 3 已跑通 AI 生成后端链路（KIE text-to-image + 4 部位 image-to-image 并发），实测总耗时 **3-9 分钟**（远超 `docs/mvp-plan.md` 写的 "10-15 秒"）。

Day 4 目标：在首页呈现完整的"上传照片 → 输入 prompt → 看结果"用户体验。

**不在 Day 4 范围**：
- `/pricing` 页面（Day 5）
- `/history` 页面（Day 6）
- 并发请求限制（Day 6 在后端加）
- Vercel 函数超时（Day 7）

---

## 2. 关键决策（已与用户确认）

| 决策点 | 选择 | 理由 |
|---|---|---|
| 长等待 UX | **同步等待 + 阶段提示** | 异步任务模型需后端改造，超出 Day 4 范围；Vercel 超时风险 Day 7 处理 |
| credits=0 体验 | **弹 toast，不跳转** | `/pricing` 还没做，避免写后续要重构的临时代码 |
| 结果展示布局 | **独立展示 Step 1 设计稿 + 4 部位 2x2** | API 已返回 `tattooDesignUrl`，对用户有独立价值（可单独保存） |

---

## 3. 架构方案

采用「单页 + 分层组件」：

- `src/app/page.tsx` 渲染 Hero（未登录只到 Hero）+ `<TattooGenerator />`（已登录）
- `TattooGenerator` 持整体状态机，子组件纯展示
- 两个 hook 封副作用：`useCredits()`、`useGeneration()`
- 数据流单向：组件 → hook → fetch → API → hook 状态 → 子组件

**为什么不用 `/generate` 独立路由**：plan 主线是 `src/app/page.tsx` 嵌入 TattooGenerator，独立路由对 MVP 无价值。

**为什么不用单文件大组件**：500+ 行难维护，违反"小而专注的单元"。

---

## 4. 文件清单

```
src/
├── app/
│   ├── page.tsx                          # 改：Hero + <TattooGenerator />（已登录）
│   └── api/
│       └── credits/route.ts              # 新：GET 返回 { credits }
├── components/
│   ├── tattoo-generator.tsx              # 新：主组件，管状态机
│   ├── image-uploader.tsx                # 新：拖拽/点击上传 + 预览
│   ├── generation-progress.tsx           # 新：多阶段进度文案 + 进度条
│   ├── generation-results.tsx            # 新：Step1 设计稿 + 4 部位 2x2 + Dialog 放大
│   ├── credits-badge.tsx                 # 新：右上角徽章
│   └── ui/                               # Shadcn 已有：button/card/dialog/input/label/textarea/sonner
├── hooks/
│   ├── use-credits.ts                    # 新：fetch /api/credits + refresh()
│   └── use-generation.ts                 # 新：状态机 + fetch /api/generate
└── types/
    └── index.ts                          # 改：补 GenerateResponse / CreditsResponse / GenerateImage
```

未做的事（YAGNI）：
- 不做 `/generate` 独立路由
- 不做 client-side supabase
- 不做并发限制前端检查（Day 6 后端加）
- 不引入新自定义颜色（沿用 Shadcn 默认主题）

---

## 5. 状态机与数据流

### 5.1 `useGeneration` 状态机

```
idle          初始：空表单
  │ 用户选照片
  ▼
uploading     POST /api/upload-url → PUT R2（5-10s）
  │ 上传成功
  ▼
ready         照片 + prompt 就绪，等待用户点 Generate
  │ 点 Generate（先查 credits）
  ├── credits=0 → toast，停在此状态
  └── credits≥1 ▼
generating    POST /api/generate，启动假进度推进 + 阶段标签
  │ fetch 返回（200 / 402 / 429 / 500 / AbortError）
  ├── 200 且 ≥1 张成功 ▼
  completed    展示设计稿 + 4 张部位图
  ├── 200 但 4 张全失败 ▼
  error        toast + "Credits refunded" + Retry
  └── 402/429/500/网络错误 ▼
  error        toast + 保留 prompt/照片 + Retry
```

### 5.2 进度推进算法（前端假进度）

后端 fetch 不返回中间状态，前端用时间表模拟：

| 时间窗口 | 阶段标签 | 进度条 |
|---|---|---|
| 0-110s | `Step 1: Designing your tattoo` | 0→45% |
| 110-250s | `Step 2: Placing on body (4 parts in parallel)` | 45→90% |
| 250s+ 未返回 | `Almost there, finalizing...` | 90→95%（卡住，不冲到 100%） |
| fetch 返回 | `Done!` | 100% |

关键：进度条永远不超过 95%，直到 fetch 真正返回，避免假象。

下方文案：`Usually takes 3-5 minutes · Elapsed: Xm Ys · Keep this tab open.`

### 5.3 `useCredits`

- 挂载时 fetch `/api/credits`
- 暴露 `refresh()`，在 generate 完成/失败后调用一次
- 状态：`{ credits: number | null, loading: boolean, error: string | null }`

### 5.4 数据流图

```
TattooGenerator
  │ useCredits() ──── GET /api/credits ──── Supabase
  │ useGeneration() ──┐
  │                   ├── POST /api/upload-url → R2 PUT
  │                   └── POST /api/generate → 后端 12 步流程
  │ refresh credits ←─────── 完成/失败回调
  ▼
ImageUploader / GenerationProgress / GenerationResults / CreditsBadge
```

---

## 6. 组件接口

```typescript
// hooks/use-credits.ts
type CreditsState = {
  credits: number | null
  loading: boolean
  error: string | null
}
function useCredits(): CreditsState & {
  refresh: () => Promise<void>
}

// hooks/use-generation.ts
type GenStatus =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'generating'
  | 'completed'
  | 'error'

type GenState = {
  status: GenStatus
  uploadProgress: number        // 0-100，仅 uploading 阶段
  generateProgress: number      // 0-100，仅 generating 阶段
  stageLabel: string            // "Step 1: Designing..."
  elapsedSeconds: number        // generating 阶段已耗时
  photoKey: string | null       // /api/upload-url 返回的 R2 key
  photoUrl: string | null       // 用于预览
  prompt: string
  result: GenerateResponse | null
  error: string | null
}
function useGeneration(): GenState & {
  setPrompt: (s: string) => void
  uploadPhoto: (file: File) => Promise<void>
  generate: () => Promise<void>
  reset: () => void
}

// components/image-uploader.tsx
type ImageUploaderProps = {
  photoUrl: string | null
  uploading: boolean
  uploadProgress: number
  onFileSelected: (file: File) => void
  onClear: () => void
  disabled?: boolean
}

// components/generation-progress.tsx
type GenerationProgressProps = {
  progress: number        // 0-100
  stageLabel: string
  elapsedSeconds: number
}

// components/generation-results.tsx
type GenerationResultsProps = {
  tattooDesignUrl: string
  images: GenerateImage[]
  onRegenerate: () => void
  onReset: () => void
}

// components/credits-badge.tsx
type CreditsBadgeProps = {
  credits: number | null
  loading: boolean
}
```

---

## 7. 类型定义（`src/types/index.ts`）

```typescript
import type { BodyPart } from '@/lib/constants'

export interface GenerateImage {
  bodyPart: BodyPart
  imageUrl: string | null
  failed: boolean
}

export interface GenerateResponse {
  projectId: string
  tattooDesignUrl: string
  images: GenerateImage[]
}

export interface CreditsResponse {
  credits: number
}
```

> **实施前先校验** Day 3 的 `src/app/api/generate/route.ts` 实际返回字段与上面 `GenerateResponse` 一致；不一致则以实际为准调整类型或后端响应。

---

## 8. API 路由

### 8.1 `GET /api/credits`（新增）

```
鉴权：Clerk session（无 → 401）
逻辑：
  1. auth() → userId + email
  2. ensureUser(userId, email)
  3. getCredits(userId)
返回：
  200 { credits: number }
  401 { error: "Unauthorized" }
  500 { error: "Internal error" }
```

复用 `ensureUser` + `getCredits`（Day 2 已实现），不引入新副作用。

### 8.2 `POST /api/generate`（已存在，仅前端契约）

后端 Day 3 实现，前端按 `GenerateResponse` 消费。如有结构差异在实施前校准。

---

## 9. 错误处理矩阵

| 场景 | HTTP | hook 行为 | 组件 UX |
|---|---|---|---|
| 未登录 | 401 | `error="Please sign in"` | toast + 跳 sign-in |
| Credits 不足 | 402 | `error="Out of credits"` | toast "Credits coming soon"，不扣 |
| 并发冲突（Day 6 加） | 429 | `error="Another generation is running"` | toast |
| 网络中断 | — | `error="Network error, please retry"` | 保留 prompt+照片，Retry |
| 服务端 500 | 500 | `error="Server error"` | 同上 |
| fetch 超时（>15min） | — | AbortController 触发 | 同上 |
| 部分成功（≥1 张） | 200 | 正常 completed，results 标记失败项 | 失败部位显示占位 |
| 4 张全失败（已退款） | 200 + images 全 failed | status='error' | toast + "Credits refunded" + Retry |

**退款语义关键**：后端 Day 3 逻辑是「4 张全失败 → 退款 + project=failed；≥1 张成功 → 不退款」。前端按 `images.every(i => i.failed)` 判断是否触发退款提示。

### 上传错误处理

| 场景 | 行为 |
|---|---|
| 文件超 10MB | 客户端预检（`MAX_UPLOAD_BYTES`），toast，不上传 |
| 非图片类型 | 同上（`ALLOWED_UPLOAD_CONTENT_TYPES`） |
| `/api/upload-url` 返回非 200 | toast "Upload failed"，状态回 `idle` |
| R2 PUT 失败 | 同上 |

---

## 10. UI 布局

### 10.1 桌面端（max-w-5xl）

```
┌─────────────────────────────────────────────────────────┐
│  Navbar                          [Credits: 1] [Buy] 👤 │
├─────────────────────────────────────────────────────────┤
│         See Your Tattoo Before You Ink                  │  ← Hero（保留）
│         Upload a photo, describe...                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Generator Card                                  │  │
│  │  ┌──────────────┐   Prompt                      │  │
│  │  │              │   ┌────────────────────────┐  │  │
│  │  │  [Upload     │   │ dragon japanese style  │  │  │
│  │  │   dropzone]  │   └────────────────────────┘  │  │
│  │  │              │   [Generate ▸]  credits: 1    │  │
│  │  └──────────────┘                                │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 10.2 `generating` 阶段（替换右栏）

```
┌──────────────────────────────────────────────────────┐
│  ✨ Generating your tattoo preview...                │
│  ✓ Step 1: Designing your tattoo                     │
│  ◌ Step 2: Placing on body (4 parts in parallel)    │
│  ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  55%                       │
│  ⏱ Usually takes 3-5 minutes · Elapsed: 1m 23s      │
│  Keep this tab open.                                 │
└──────────────────────────────────────────────────────┘
```

### 10.3 `completed` 阶段

```
┌─────────────────────────────────────────────────────┐
│  ✨ Your Tattoo Design                              │
│  ┌─────────────────────────────────────────────┐  │
│  │       [Step 1 纹身图案设计稿 大图]           │  │  ← 独立大图
│  └─────────────────────────────────────────────┘  │
│  Placed on 4 body parts · click to zoom            │
│  ┌─────────┐  ┌─────────┐                         │
│  │ Left Arm│  │Right Arm│                         │  ← 2x2 网格
│  └─────────┘  └─────────┘                         │
│  ┌─────────┐  ┌─────────┐                         │
│  │ Shoulder│  │  Calf   │                         │
│  └─────────┘  └─────────┘                         │
│  [Try another idea]   [Start over]                 │
└─────────────────────────────────────────────────────┘
```

### 10.4 失败部位占位

```
┌─────────┐
│   ⚠     │
│ This    │   ← bg-muted + text-muted-foreground
│ part    │     不可点击放大
│ failed  │
└─────────┘
```

### 10.5 移动端

- 单列：上传 / prompt / 按钮 / 结果依次堆叠
- 2x2 结果网格在 < 640px 保持 2 列（每格缩小）
- Hero 字号减小（已有 `text-4xl sm:text-6xl`）
- Navbar 沿用现有（Day 6 打磨）

### 10.6 配色与组件

- 沿用 Tailwind v4 + Shadcn 默认主题
- Hero CTA 主色：默认 primary
- Generate 按钮：`size="lg"`
- Credits 徽章：`variant="outline"`，位于 Hero 右上或 Generator Card 右上
- 失败占位：`bg-muted` + `text-muted-foreground`
- 不引入新自定义颜色

---

## 11. 未做的事（YAGNI 清单）

- `/generate` 独立路由
- 客户端 supabase（MVP 禁用）
- 并发请求限制（Day 6 后端加）
- Vercel 函数超时处理（Day 7）
- 部分失败时的"单独重试某部位"按钮（Day 4 先展示占位，Day 6 再加）
- 国际化（i18n），UI 文案保持英文
- 暗色模式切换器（沿用系统默认）
- 单元测试（MVP 阶段不强制 TDD，手动验证为准）

---

## 12. 验收标准

- [ ] 拖拽或点击上传照片 → 显示缩略图预览
- [ ] 上传 >10MB 或非图片文件 → toast 错误，不上传
- [ ] 输入 prompt 后 Generate 按钮可点
- [ ] credits=0 时点 Generate → toast "Credits coming soon"，不跳转
- [ ] credits≥1 时点 Generate → 进入 generating 阶段，进度条推进 + 阶段标签更新
- [ ] 3-9 分钟后 fetch 返回，切换到 completed
- [ ] completed 显示 Step 1 设计稿大图 + 4 部位 2x2 网格
- [ ] 点击任一成功图弹出 Dialog 大图
- [ ] 失败部位显示占位，不可点击
- [ ] credits 徽章在生成后自动刷新（-1 或退款后 +1）
- [ ] 4 张全失败 → toast "Credits refunded" + Retry 按钮
- [ ] "Try another idea" 保留照片，清空 prompt
- [ ] "Start over" 全部重置回 idle
- [ ] 移动端单列布局基本可用，不崩

---

## 13. 风险与备注

| 风险 | 影响 | 应对 |
|---|---|---|
| Vercel Hobby 函数 10s 超时 | 生成直接失败 | Day 7 升级 Pro 或改异步；Day 4 本地开发不受影响 |
| 浏览器长连接被代理/防火墙掐 | fetch 报错 | 进度条 90% 时显示提示文案，AbortController 15min 超时兜底 |
| 用户离开/刷新页面 | 已扣 credits 但未拿到结果 | Day 6 加 `/history` 后可从历史找回；Day 4 暂不处理 |
| 假进度与真实进度严重不符 | 用户焦虑 | 进度条不超过 95%，"Usually takes 3-5 minutes" 文案兜底 |
| 后端 `GenerateResponse` 字段名与设计不一致 | 前端类型错误 | 实施前先读 `src/app/api/generate/route.ts` 校准 |

---

## 14. 下一步

调用 `superpowers:writing-plans` skill 把这份设计转成可逐步执行的实施计划（拆 commit、按顺序实施、每步验收）。
