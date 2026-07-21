# Day 6 历史记录页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在 `/history` 看到所有已生成的纹身记录，点击缩略图弹 Dialog 看大图并支持左右切换。

**Architecture:** Server Component 直查 Supabase（`projects` join `generations`，只查 `status='completed'`） → 单列大卡片渲染 → 缩略图按钮 + 大图 Dialog 由 Client Component 管理 state。

**Tech Stack:** Next.js 16 App Router + Supabase（service_role）+ Clerk（已集成）+ Shadcn UI（已有 dialog）+ Tailwind v4

**Spec:** [`docs/superpowers/specs/2026-07-21-day6-history-page-design.md`](../specs/2026-07-21-day6-history-page-design.md)

**项目约定**（来自 CLAUDE.md / mvp-plan.md / Day 5 plan）：
- 所有回答用中文；commit message 用中文
- MVP 阶段不强制 TDD，每个任务用「实现 → 手动验证」模式
- Shadcn 已有：button/card/dialog/input/label/textarea/sonner，**不要再 add 新组件**
- Tailwind v4 CSS-first（无 `tailwind.config.ts`），沿用默认主题
- 服务端 Supabase 走 `getSupabaseAdmin()`（service_role，lazy）
- R2 公开 URL 用 `getPublicUrl(key)`（`src/lib/r2.ts`）
- 所有 commit 结尾加 `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## File Structure

| 文件 | 责任 | 创建/修改 |
|---|---|---|
| `src/types/index.ts` | 加 `ProjectWithGenerations` 类型 | 修改 |
| `src/server/db/queries.ts` | 加 `listProjects(userId)` 查询函数 | 修改 |
| `src/components/history-image-dialog.tsx` | Client Component：缩略图网格 + Dialog 大图 + 左右切换 | 创建 |
| `src/components/history-card.tsx` | Server Component：单条卡片静态布局 | 创建 |
| `src/components/history-list.tsx` | Server Component：标题 + 容器 + 空状态 | 创建 |
| `src/app/history/page.tsx` | Server Component：auth + ensureUser + listProjects + 渲染容器 | 创建 |
| `docs/handoff.md` | 更新 Day 6 完成状态 + Day 7 准备清单 | 修改 |

**已有可复用资源**（不要重写）：
- `src/lib/constants.ts` 的 `BODY_PARTS` / `BODY_PART_LABELS`（部位顺序与标签）
- `src/lib/r2.ts` 的 `getPublicUrl(key)`（key → 公开 URL）
- `src/server/db/ensure-user.ts` 的 `ensureUser(clerkUserId, email)`
- `src/components/ui/dialog.tsx`（Shadcn Dialog 已存在）
- `src/middleware.ts` 已保护 `/history`（Day 1 已配，未登录跳 sign-in）
- `src/components/navbar.tsx` 已有 `/history` 链接（Day 4 已加）

---

## Task 1: 加 ProjectWithGenerations 类型 + listProjects 查询

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/server/db/queries.ts`

- [ ] **Step 1: 在 `src/types/index.ts` 末尾追加类型**

打开 `src/types/index.ts`，在文件末尾追加：

```typescript
/* ============ Day 6: 历史记录页 ============ */

/** 单个 project 关联其 4 条 generations（Supabase join 查询返回结构） */
export type ProjectWithGenerations = ProjectRow & {
  generations: GenerationRow[]
}
```

- [ ] **Step 2: 在 `src/server/db/queries.ts` 末尾追加 listProjects 函数**

打开 `src/server/db/queries.ts`，在文件末尾追加（注意 import 区已有 `ProjectRow`，需要追加 `ProjectWithGenerations`）：

先改 import 行（第 2 行）：
```typescript
import type { GenerationRow, ProjectRow, ProjectWithGenerations, UserRow } from '@/types'
```

然后在文件末尾追加：
```typescript
/**
 * 拉取用户所有已完成的 projects（含关联的 generations）。
 * 按 created_at desc 排序，最新的在前。
 * Supabase 嵌套 select '*, generations(*)' 会自动按 project_id 外键关联。
 */
export async function listProjects(
  userId: string
): Promise<ProjectWithGenerations[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*, generations(*)')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProjectWithGenerations[]
}
```

- [ ] **Step 3: 验证编译**

Run: `npm run build`

Expected: 编译通过。如果报 `Type 'PostgrestBuilder...' is not assignable` 类型错，检查 `ProjectRow` 字段名与 `supabase/migrations/0001_init.sql` 是否一致；如 `generations` 字段类型不匹配，把返回类型 cast 改为 `as unknown as ProjectWithGenerations[]`。

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/server/db/queries.ts
git commit -m "$(cat <<'EOF'
feat: 添加 listProjects 查询用户历史生成记录

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 创建 HistoryImageDialog Client Component

**Files:**
- Create: `src/components/history-image-dialog.tsx`

这个组件同时负责「渲染缩略图网格」+「弹出 Dialog 大图」两件事，因为它们共享同一组 state。`HistoryCard` 会把整个图片区域委托给它。

- [ ] **Step 1: 创建文件 `src/components/history-image-dialog.tsx`**

完整文件内容：

```typescript
'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'

/**
 * 历史卡片里的图片区域。
 *
 * 同时渲染：
 *   - 左侧纹身设计稿缩略图（1:1）
 *   - 右侧 4 部位 2x2 缩略图（3:4）
 *   - 点击任意图弹出 Dialog 看大图，支持左右切换
 *
 * 所有按钮和 Dialog 在同一个 Client Component 里，因为它们共享 openIndex state。
 * HistoryCard（Server）只渲染静态文本（prompt/时间），把图片区整个委托给本组件。
 */

type DialogImage = { url: string; title: string }

type BodyPartThumb = {
  label: string
  url: string | null  // null 表示该部位失败
}

type Props = {
  tattooDesignUrl: string | null
  bodyParts: BodyPartThumb[]  // 已按 BODY_PARTS 排序
}

export function HistoryImageDialog({ tattooDesignUrl, bodyParts }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // 拍平成 Dialog 切换列表：[设计稿（若有）, 部位1（若成功）, 部位2（若成功）, ...]
  const images: DialogImage[] = []
  if (tattooDesignUrl) {
    images.push({ url: tattooDesignUrl, title: 'Tattoo Design' })
  }
  bodyParts.forEach((bp) => {
    if (bp.url) images.push({ url: bp.url, title: bp.label })
  })

  const designIndex = tattooDesignUrl ? 0 : -1

  const goPrev = () =>
    setOpenIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
  const goNext = () =>
    setOpenIndex((i) => (i === null ? null : (i + 1) % images.length))

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
        {/* 左：纹身设计稿 1:1 */}
        <div className="sm:w-1/3">
          {tattooDesignUrl ? (
            <button
              type="button"
              onClick={() => designIndex >= 0 && setOpenIndex(designIndex)}
              className="group block w-full overflow-hidden rounded-lg border border-border/50 bg-muted"
              aria-label="View tattoo design"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tattooDesignUrl}
                alt="Generated tattoo design"
                className="aspect-square w-full object-contain transition-transform group-hover:scale-[1.01]"
              />
            </button>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-border/50 bg-muted text-xs text-muted-foreground">
              Design unavailable
            </div>
          )}
        </div>

        {/* 右：4 部位 2x2 */}
        <div className="grid flex-1 grid-cols-2 gap-3">
          {bodyParts.map((bp) => (
            <BodyPartCell
              key={bp.label}
              bodyPart={bp}
              onClick={() => {
                const idx = images.findIndex((img) => img.url === bp.url)
                if (idx >= 0) setOpenIndex(idx)
              }}
            />
          ))}
        </div>
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-w-3xl bg-background p-2 sm:p-3">
          <DialogTitle className="sr-only">
            {openIndex !== null ? images[openIndex]?.title : 'Image preview'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged preview of the generated tattoo image. Use left and right arrows to navigate.
          </DialogDescription>

          {openIndex !== null && images[openIndex] && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[openIndex].url}
                alt={images[openIndex].title}
                className="h-auto w-full rounded-lg object-contain"
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    aria-label="Previous image"
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur transition hover:bg-background"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    aria-label="Next image"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-background/80 p-2 backdrop-blur transition hover:bg-background"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                    {openIndex + 1} / {images.length}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function BodyPartCell({
  bodyPart,
  onClick,
}: {
  bodyPart: BodyPartThumb
  onClick: () => void
}) {
  if (!bodyPart.url) {
    return (
      <div className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-lg border border-border/50 bg-muted p-3 text-center">
        <span className="text-xs font-medium">{bodyPart.label}</span>
        <span className="text-xs text-muted-foreground">Failed</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/50 bg-muted"
      aria-label={`View tattoo on ${bodyPart.label}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bodyPart.url}
        alt={`Tattoo on ${bodyPart.label}`}
        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
      />
      <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
        {bodyPart.label}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: 验证 lint + 编译**

Run: `npm run lint && npm run build`

Expected: 都通过。如果 lint 报 `react-hooks/set-state-in-effect` 等规则错误（与 Day 5 同类问题），检查是否在 effect 里调用 setState——本组件的 setState 都在事件处理函数里，应该没问题。如果 `lucide-react` 缺包，运行 `npm install lucide-react`（实际 Day 4 已装，不应缺失）。

- [ ] **Step 3: Commit**

```bash
git add src/components/history-image-dialog.tsx
git commit -m "$(cat <<'EOF'
feat: 添加 HistoryImageDialog 组件（缩略图网格 + 大图 Dialog）

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: 创建 HistoryCard Server Component

**Files:**
- Create: `src/components/history-card.tsx`

- [ ] **Step 1: 创建文件 `src/components/history-card.tsx`**

完整文件内容：

```typescript
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '@/lib/constants'
import { getPublicUrl } from '@/lib/r2'
import { HistoryImageDialog } from '@/components/history-image-dialog'
import type { ProjectWithGenerations } from '@/types'

/**
 * 单条历史卡片（Server Component）。
 *
 * 布局：
 *   ┌─────────────────────────────────────────────┐
 *   │  "prompt 文字"           时间 · N/4          │  ← 头部静态文本
 *   │  ┌────────┐  ┌────┐ ┌────┐                  │
 *   │  │ design │  │L.A │ │R.A │                  │  ← HistoryImageDialog
 *   │  │  1:1   │  └────┘ └────┘                  │     （Client 子组件）
 *   │  │        │  ┌────┐ ┌────┐                  │
 *   │  │        │  │Shol│ │Calf│                  │
 *   │  └────────┘  └────┘ └────┘                  │
 *   └─────────────────────────────────────────────┘
 *
 * 静态文本（prompt / 时间 / 部位 label）由本组件渲染，
 * 所有图片相关交互（缩略图 + Dialog）委托给 HistoryImageDialog。
 */
export function HistoryCard({ project }: { project: ProjectWithGenerations }) {
  // 按 BODY_PARTS 顺序排列 generations（DB 返回顺序不保证）
  const bodyPartThumbs = BODY_PARTS.map((part) => {
    const gen = project.generations.find((g) => g.body_part === part)
    const label = BODY_PART_LABELS[part as BodyPart]
    return {
      label,
      url: gen?.result_image_url ?? null,
    }
  })

  // 纹身设计稿 key 由 4 条 generations 共享，取第一条的 tattoo_image_key
  const tattooDesignKey = project.generations[0]?.tattoo_image_key ?? null
  const tattooDesignUrl = tattooDesignKey ? getPublicUrl(tattooDesignKey) : null

  // 成功部位数
  const successCount = bodyPartThumbs.filter((bp) => bp.url !== null).length

  const createdLabel = new Date(project.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <article className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <p className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
          “{project.prompt}”
        </p>
        <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <time dateTime={project.created_at}>{createdLabel}</time>
          <span>
            {successCount}/{BODY_PARTS.length} succeeded
          </span>
        </div>
      </header>

      <HistoryImageDialog
        tattooDesignUrl={tattooDesignUrl}
        bodyParts={bodyPartThumbs}
      />
    </article>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npm run build`

Expected: 编译通过。`getPublicUrl` 已存在于 `src/lib/r2.ts:49`。

- [ ] **Step 3: Commit**

```bash
git add src/components/history-card.tsx
git commit -m "$(cat <<'EOF'
feat: 添加 HistoryCard 单条历史卡片组件

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 创建 HistoryList Server Component（含空状态）

**Files:**
- Create: `src/components/history-list.tsx`

- [ ] **Step 1: 创建文件 `src/components/history-list.tsx`**

完整文件内容：

```typescript
import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HistoryCard } from '@/components/history-card'
import type { ProjectWithGenerations } from '@/types'

/**
 * 历史列表容器（Server Component）。
 *
 * - 有记录：标题 + 数量 + HistoryCard 列表
 * - 空状态：图标 + 文案 + CTA 跳首页
 */
export function HistoryList({ projects }: { projects: ProjectWithGenerations[] }) {
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-semibold">No tattoos yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate your first AI tattoo to see it here.
          </p>
        </div>
        <Link href="/">
          <Button>Create Tattoo</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your Tattoos</h1>
        <span className="text-sm text-muted-foreground">
          {projects.length} {projects.length === 1 ? 'creation' : 'creations'}
        </span>
      </header>

      <div className="flex flex-col gap-6">
        {projects.map((project) => (
          <HistoryCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npm run build`

Expected: 编译通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/history-list.tsx
git commit -m "$(cat <<'EOF'
feat: 添加 HistoryList 历史列表容器与空状态

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 创建 /history 路由页（Server Component）

**Files:**
- Create: `src/app/history/page.tsx`

- [ ] **Step 1: 创建文件 `src/app/history/page.tsx`**

完整文件内容：

```typescript
import { auth, currentUser } from '@clerk/nextjs/server'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HistoryList } from '@/components/history-list'
import { ensureUser } from '@/server/db/ensure-user'
import { listProjects } from '@/server/db/queries'

export const metadata = {
  title: 'History — AI Tattoo Generator',
  description: 'View your past AI tattoo generations.',
}

/**
 * /history 历史记录页。
 *
 * middleware 已保护本路由（未登录跳 sign-in），所以这里假设已登录。
 * 即便如此，仍防御性检查 auth() / currentUser()，避免边缘情况。
 *
 * 流程：
 *   1. auth() → userId（未登录理论上不会到这里，但兜底）
 *   2. ensureUser → 确保数据库存在该用户记录
 *   3. listProjects → 查所有 completed projects
 *   4. 渲染 HistoryList（含空状态）
 *
 * 错误兜底：任何步骤失败渲染友好错误页 + Retry 按钮。
 */
export default async function HistoryPage() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId || !user) {
    // 理论上 middleware 会拦截；兜底渲染错误提示
    return <HistoryError />
  }

  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return <HistoryError />
  }

  try {
    await ensureUser(userId, email)
    const projects = await listProjects(userId)
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <HistoryList projects={projects} />
      </div>
    )
  } catch (e) {
    console.error('[/history] failed to load:', e)
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <HistoryError />
      </div>
    )
  }
}

function HistoryError() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
      <RotateCcw className="h-10 w-10 text-muted-foreground" />
      <div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load your history. Please try again.
        </p>
      </div>
      <Link href="/history">
        <Button variant="outline">Retry</Button>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: 验证编译**

Run: `npm run build`

Expected: 编译通过。如有错误 `Module not found` 检查 import 路径；`Type X is not assignable` 检查 `listProjects` 返回类型与 `HistoryList` props 是否匹配。

- [ ] **Step 3: Commit**

```bash
git add src/app/history/page.tsx
git commit -m "$(cat <<'EOF'
feat: 添加 /history 历史记录页

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 端到端手动验证

**Files:** 无修改，仅运行验证。

- [ ] **Step 1: 启动 dev server**

Run: `npm run dev`

Expected: 启动成功，访问 `http://localhost:3000`。

- [ ] **Step 2: lint + build 全量检查**

新开终端 Run: `npm run lint && npm run build`

Expected: 都通过。如 build 报 `useSearchParams() should be wrapped in a suspense boundary`——本 Day 6 没用 `useSearchParams`，不应该报；如果报了，检查是否误用。

- [ ] **Step 3: 已登录有记录场景**

操作：
1. 浏览器打开 `http://localhost:3000`
2. 用 Day 4-5 已测试过的 Clerk 账号登录（已有 project 记录）
3. 点击 navbar 的 "History" 链接 → 跳 `/history`
4. 检查页面：
   - 标题 "Your Tattoos" + creations 数量正确
   - 每条卡片显示 prompt + 时间 + 4/4 succeeded
   - 左侧纹身设计稿缩略图加载
   - 右侧 4 部位 2x2 缩略图加载
   - 时间显示格式为 "Jul 21, 2026" 之类

Expected: 所有项目都正常显示，缩略图加载成功（如果加载失败检查 R2_PUBLIC_URL 是否正确）。

- [ ] **Step 4: Dialog 大图交互**

操作：
1. 点击左侧纹身设计稿 → 弹 Dialog 显示大图
2. 点击右下角 → 按钮 → 切换到下一张
3. 点击左下角 ← 按钮 → 切换回上一张
4. 按 Esc → 关闭 Dialog
5. 点击右侧任一部位缩略图 → 弹 Dialog，索引定位到该部位

Expected: Dialog 切换流畅，索引显示 "N / M" 正确，Esc 可关闭。

- [ ] **Step 5: 空状态场景**

操作：
1. 退出登录
2. 注册一个新 Clerk 账号（或用一个没有 project 的账号）
3. 访问 `/history`

Expected: 显示空状态卡片 "No tattoos yet" + "Create Tattoo" 按钮，点击跳 `/`。

- [ ] **Step 6: 未登录拦截**

操作：
1. 退出登录
2. 直接访问 `http://localhost:3000/history`

Expected: Clerk 重定向到 sign-in 页。

- [ ] **Step 7: 数据异常降级（可选）**

如果数据库里有部分异常数据（例如某个 generation 缺 `result_image_url`），该位置应显示 "Failed" 占位。可通过 Supabase Dashboard 手动改一条数据测试，或跳过此步。

Expected: 缺图位置显示 "Failed" 文案，其他位置正常。

---

## Task 7: 更新 docs/handoff.md

**Files:**
- Modify: `docs/handoff.md`

- [ ] **Step 1: 修改进度表**

打开 `docs/handoff.md`，找到 §2「进度总览」表格，把 Day 6 行改为：

```markdown
| 6 | 历史记录 + UI 打磨 | ✅ 已完成（Day 6 多个 commit）|
| 7 | 部署 Vercel + 端到端验证 | ⏳ 下一步 |
```

把「上次更新」日期改为 `2026-07-21`，把「当前进度」改为 `Day 1-6 已完成，准备进入 Day 7`。

- [ ] **Step 2: 在 §3 Git 历史前面追加 Day 6 的 commit**

把本次 Day 6 的 5 个 commit hash 按时间倒序加在最前面（具体 hash 通过 `git log --oneline -10` 拿）：

```markdown
<newest-hash>  docs: 更新交接文档，Day 6 完成，准备 Day 7               ← Day 6（最新）
<a-hash>       feat: 添加 /history 历史记录页                             ← Day 6
<b-hash>       feat: 添加 HistoryList 历史列表容器与空状态                ← Day 6
<c-hash>       feat: 添加 HistoryCard 单条历史卡片组件                    ← Day 6
<d-hash>       feat: 添加 HistoryImageDialog 组件（缩略图网格 + 大图 Dialog） ← Day 6
<e-hash>       feat: 添加 listProjects 查询用户历史生成记录               ← Day 6
04109a5  docs: 添加 Day 6 历史记录页设计文档                              ← Day 6 spec
20c00a0  docs: 更新交接文档，Day 5 完成，准备 Day 6                       ← Day 5
...
```

- [ ] **Step 3: 在 §8 末尾追加 Day 6 完成回顾 + Day 7 准备清单**

在 `docs/handoff.md` 的 §8.8「Day 6 要做的事」之后追加新的小节 §8.10：

```markdown
### 8.10 Day 6 完成回顾 + Day 7 准备清单

**Commit 范围**：`04109a5`（设计文档）+ 5 个实现 commit，共 6 个。

✅ **Day 6 已完成事项**：

**新增模块**：
- `src/types/index.ts` — 加 `ProjectWithGenerations` 类型
- `src/server/db/queries.ts` — 加 `listProjects(userId)` 查询（Supabase 嵌套 select `*, generations(*)`）
- `src/components/history-image-dialog.tsx` — Client Component，缩略图网格 + Dialog 大图 + 左右切换
- `src/components/history-card.tsx` — Server Component，单条卡片静态布局 + 委托图片区给 Dialog
- `src/components/history-list.tsx` — Server Component，容器 + 标题 + 空状态
- `src/app/history/page.tsx` — Server Component，auth + ensureUser + listProjects + 渲染容器 + 错误兜底

**复用既有资源**（无修改）：
- `src/middleware.ts` 已保护 `/history`
- `src/components/navbar.tsx` 已有 History 链接
- `src/lib/constants.ts` 的 `BODY_PARTS` / `BODY_PART_LABELS`
- `src/lib/r2.ts` 的 `getPublicUrl(key)`
- Shadcn `Dialog` 组件（Day 4 已加）

**Day 6 设计要点**：
- Server Component 直查 DB（与 /pricing 一致），Dialog 作为 Client 子组件
- 只查 status='completed'，失败记录不显示
- 全量返回无分页（MVP 用户量小）
- 时间用 `toLocaleDateString('en-US', { year, month: 'short', day })` → "Jul 21, 2026"
- HistoryImageDialog 同时负责「缩略图网格」+「Dialog 大图」，因为共享 openIndex state

**Day 6 端到端验证**（全部 ✅）：
- 已登录访问 /history → 显示所有 completed projects，倒序
- 点缩略图 → Dialog 弹大图，左右切换 + Esc 关闭
- 空状态：新 Clerk 账号访问 → "No tattoos yet" + CTA
- 未登录访问 → middleware 重定向 sign-in
- lint + build 全部通过

### 8.11 Day 7 要做的事（部署 + 端到端验证）

详见 `docs/mvp-plan.md` Day 7 章节。核心：
- Vercel 部署 + 环境变量配置
- Clerk production origins + redirect URLs
- Stripe webhook endpoint 改为生产域名
- R2 自定义域名（可选）
- 端到端验证清单（见 mvp-plan.md §验证）
```

- [ ] **Step 4: 更新 §10 已知问题**

把原 §10 里这一行：
```markdown
| 没做生成请求的并发限制（同一用户 30 秒内可重复刷） | 中 | Day 6 加：在 deductCredits 前查 `projects` 表最近 30 秒记录 |
```
保留不动（Day 6 没做这个，仍待办，但可以改为：
```markdown
| 没做生成请求的并发限制（同一用户 30 秒内可重复刷） | 中 | Day 7 部署后看是否被薅羊毛再决定是否做 |
```

并把：
```markdown
| 用户支付时关闭浏览器，payments 永远 pending | 低 | Stripe 不发 webhook；Day 6/7 加 cron 清理 >7 天 pending 记录 |
```
改为：
```markdown
| 用户支付时关闭浏览器，payments 永远 pending | 低 | Stripe 不发 webhook；Day 7+ 后续可加 cron 清理 >7 天 pending 记录 |
```

- [ ] **Step 5: Commit**

```bash
git add docs/handoff.md
git commit -m "$(cat <<'EOF'
docs: 更新交接文档，Day 6 完成，准备 Day 7

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

实施完成后，跑一遍检查：

- [ ] **Spec coverage**：
  - ✅ Server Component 直查 → Task 5
  - ✅ 只查 completed → Task 1 的 listProjects
  - ✅ 全量返回 → Task 1
  - ✅ 弹 Dialog → Task 2 的 HistoryImageDialog
  - ✅ 单列大卡片 → Task 3 的 HistoryCard
  - ✅ 空状态 → Task 4 的 HistoryList
  - ✅ 时间格式 → Task 3 的 `toLocaleDateString`
  - ✅ 错误处理 → Task 5 的 HistoryError + Task 3 的 tattooDesignKey null + Task 2 的 BodyPartCell null
  - ✅ 部位排序 → Task 3 用 `BODY_PARTS` 重新排序
  - ✅ lint + build → Task 6 Step 2
  - ✅ 手动验证 → Task 6 Step 3-7

- [ ] **Type consistency**：
  - `ProjectWithGenerations` 定义在 Task 1，使用在 Task 3 / Task 4 / Task 5 ✅
  - `listProjects(userId)` 返回 `Promise<ProjectWithGenerations[]>`，HistoryList props 接收 `ProjectWithGenerations[]` ✅
  - `HistoryImageDialog` 的 props（`tattooDesignUrl`, `bodyParts`）在 Task 3 调用处与 Task 2 定义一致 ✅
  - `bodyParts` 项结构 `{ label: string, url: string | null }` 在 Task 2 定义、Task 3 构造 ✅

- [ ] **Placeholder scan**：无 TODO / TBD / "implement later"。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-21-day6-history.md`.
