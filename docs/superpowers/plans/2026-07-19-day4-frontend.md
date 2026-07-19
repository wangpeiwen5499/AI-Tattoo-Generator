# Day 4 前端生成页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页呈现完整的"上传照片 → 输入 prompt → 看 4 部位融合结果"用户体验，连接 Day 3 已完成的 `/api/generate` 后端。

**Architecture:** 单页 + 分层组件。`TattooGenerator` 持状态机，子组件（`ImageUploader` / `GenerationProgress` / `GenerationResults` / `CreditsBadge`）纯展示；两个 hook（`useCredits` / `useGeneration`）封装所有副作用与 fetch 调用。

**Tech Stack:** Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + Shadcn UI（base-ui）+ sonner toast + Clerk（已集成）

**Spec:** [`docs/superpowers/specs/2026-07-19-day4-frontend-design.md`](../specs/2026-07-19-day4-frontend-design.md)

**项目约定**（来自 CLAUDE.md / mvp-plan.md）：
- 所有回答用中文；commit message 用中文
- MVP 阶段不强制 TDD，每个任务用「实现 → 手动验证」模式
- Shadcn 已有：button/card/dialog/input/label/textarea/sonner，**不要再 add 新组件**
- Tailwind v4 CSS-first（无 `tailwind.config.ts`），沿用默认主题
- Clerk Core 3：用 `<Show when="signed-in">` / `<Show when="signed-out">`

---

## File Structure

| 文件 | 责任 | 创建/修改 |
|---|---|---|
| `src/types/index.ts` | 补 API 响应类型 | 修改 |
| `src/app/api/credits/route.ts` | GET 返回当前用户 credits | 创建 |
| `src/hooks/use-credits.ts` | fetch /api/credits + refresh() | 创建 |
| `src/hooks/use-generation.ts` | 状态机 + 上传 + 生成 + 假进度 | 创建 |
| `src/components/credits-badge.tsx` | credits 徽章 UI | 创建 |
| `src/components/image-uploader.tsx` | 拖拽/点击上传 + 预览 | 创建 |
| `src/components/generation-progress.tsx` | 进度条 + 阶段标签 | 创建 |
| `src/components/generation-results.tsx` | Step1 设计稿 + 4 部位 2x2 + Dialog 放大 | 创建 |
| `src/components/tattoo-generator.tsx` | 主组件，组装子组件 | 创建 |
| `src/app/page.tsx` | Hero + TattooGenerator（已登录） | 修改 |
| `docs/handoff.md` | 更新进度总览 | 修改 |

**后端契约（已校验，源自 `src/app/api/generate/route.ts`）**：

```ts
// /api/generate 成功响应（HTTP 200）
{
  projectId: string,
  tattooDesignUrl: string,
  images: [
    { bodyPart: 'left_arm'|'right_arm'|'shoulder'|'calf', status: 'completed'|'failed', url: string|null, error: string|null }
  ]
}

// /api/generate 全失败响应（HTTP 500，已退款）
{
  projectId: string,
  tattooDesignUrl: string,
  images: [...],           // 全部 status='failed'
  error: 'All generations failed, credits refunded'
}

// /api/generate 其他错误（HTTP 401/402/400/500）
{ error: string, detail?: string }

// /api/upload-url 响应
{ key: string, uploadUrl: string, publicUrl: string }
```

---

## Task 1: 补 API 响应类型

**Files:**
- Modify: `src/types/index.ts`（追加，不动现有类型）

- [ ] **Step 1: 读取当前 types 文件确认结构**

Run: `cat src/types/index.ts`（用 Read 工具）
Expected: 现有 `UserRow` / `ProjectRow` / `GenerationRow` / `PaymentRow` 类型保持不变

- [ ] **Step 2: 在 `src/types/index.ts` 末尾追加 API 响应类型**

在文件末尾追加（不删除现有内容）：

```typescript
/* ============ API 响应类型 ============ */

import type { BodyPart } from '@/lib/constants'

/** /api/upload-url 响应 */
export interface UploadUrlResponse {
  key: string
  uploadUrl: string
  publicUrl: string
}

/** /api/credits 响应 */
export interface CreditsResponse {
  credits: number
}

/** /api/generate 单张部位图结果（与后端 route.ts 返回结构一致） */
export interface GenerateImage {
  bodyPart: BodyPart
  status: 'completed' | 'failed'
  url: string | null
  error?: string | null
}

/** /api/generate 成功响应 */
export interface GenerateResponse {
  projectId: string
  tattooDesignUrl: string
  images: GenerateImage[]
  /** 全失败时后端会带这个字段，提示已退款 */
  error?: string
}
```

- [ ] **Step 3: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误（如果 `BodyPart` import 报循环依赖，把 import 改为 inline `bodyPart: 'left_arm' | 'right_arm' | 'shoulder' | 'calf'`）

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: 补充 Day 4 前端所需的 API 响应类型"
```

---

## Task 2: GET /api/credits 接口

**Files:**
- Create: `src/app/api/credits/route.ts`

- [ ] **Step 1: 创建路由文件**

文件内容：

```typescript
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import { getCredits } from '@/server/db/queries'
import type { CreditsResponse } from '@/types'

/**
 * GET /api/credits
 *
 * 返回当前 Clerk 用户的 credits 余额。
 * 副作用：首次调用会 ensureUser 创建用户记录（送 1 免费 credit）。
 *
 * 响应：
 *   200 { credits: number }
 *   401 未登录
 *   500 服务端错误
 */
export async function GET(): Promise<Response> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json(
      { error: 'Email is required. Please add an email in your account.' },
      { status: 400 }
    )
  }

  try {
    await ensureUser(userId, email)
  } catch (e) {
    console.error('[credits] ensureUser failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  try {
    const credits = await getCredits(userId)
    return NextResponse.json({ credits } satisfies CreditsResponse)
  } catch (e) {
    console.error('[credits] getCredits failed:', e)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
```

- [ ] **Step 2: 启动 dev server**

Run: `npm run dev`
Expected: 监听 `http://localhost:3000`，无编译错误

- [ ] **Step 3: 浏览器 DevTools 手动测试**

登录后访问 `http://localhost:3000`，打开 DevTools Console，执行：

```javascript
fetch('/api/credits').then(r => r.json()).then(console.log)
```

Expected: `{ credits: 1 }`（或当前实际余额）

退出登录后再执行同一命令：
Expected: `{ error: "Unauthorized" }` HTTP 401

- [ ] **Step 4: Commit**

```bash
git add src/app/api/credits/route.ts
git commit -m "feat: 添加 GET /api/credits 接口查询余额"
```

---

## Task 3: useCredits hook

**Files:**
- Create: `src/hooks/use-credits.ts`

- [ ] **Step 1: 创建 hooks 目录与文件**

文件内容：

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'

type CreditsState = {
  credits: number | null
  loading: boolean
  error: string | null
}

/**
* 查询当前用户的 credits 余额。
* 挂载时自动请求一次；暴露 refresh() 用于生成完成后刷新。
*/
export function useCredits() {
  const [state, setState] = useState<CreditsState>({
    credits: null,
    loading: true,
    error: null,
  })

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data: { credits: number } = await res.json()
      setState({ credits: data.credits, loading: false, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { ...state, refresh }
}
```

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-credits.ts
git commit -m "feat: 添加 useCredits hook"
```

---

## Task 4: CreditsBadge 组件

**Files:**
- Create: `src/components/credits-badge.tsx`

- [ ] **Step 1: 创建组件**

文件内容：

```typescript
'use client'

import { Card, CardContent } from '@/components/ui/card'

type Props = {
  credits: number | null
  loading: boolean
}

/**
* 右上角小卡片：显示当前 credits 余额。
* loading 时显示骨架占位，error/null 时显示 "—"。
*/
export function CreditsBadge({ credits, loading }: Props) {
  return (
    <Card className="border-border/50 bg-background/60 px-3 py-2 backdrop-blur">
      <CardContent className="flex items-center gap-2 p-0">
        <span className="text-xs font-medium text-muted-foreground">Credits</span>
        <span
          className="text-sm font-semibold tabular-nums"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? '…' : credits ?? '—'}
        </span>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误（如果 `CardContent` 导入名与实际不符，先 Read `src/components/ui/card.tsx` 确认导出名）

- [ ] **Step 3: Commit**

```bash
git add src/components/credits-badge.tsx
git commit -m "feat: 添加 CreditsBadge 组件"
```

---

## Task 5: ImageUploader 组件

**Files:**
- Create: `src/components/image-uploader.tsx`

- [ ] **Step 1: 创建组件**

文件内容：

```typescript
'use client'

import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'

type Props = {
  photoUrl: string | null
  uploading: boolean
  uploadProgress: number
  onFileSelected: (file: File) => void
  onClear: () => void
  disabled?: boolean
}

const MAX_MB = MAX_UPLOAD_BYTES / 1024 / 1024

/**
* 拖拽 + 点击上传组件。
* - 客户端预检 size / type（不通过不上传）
* - 显示预览缩略图（来自 R2 publicUrl）
* - uploading 时显示进度百分比
*/
export function ImageUploader({
  photoUrl,
  uploading,
  uploadProgress,
  onFileSelected,
  onClear,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function validateAndSubmit(file: File) {
    setLocalError(null)

    if (!(ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(file.type)) {
      setLocalError(`Unsupported file type. Allowed: ${ALLOWED_UPLOAD_CONTENT_TYPES.join(', ')}`)
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(`File too large. Max ${MAX_MB}MB.`)
      return
    }

    onFileSelected(file)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const file = e.dataTransfer.files?.[0]
    if (file) validateAndSubmit(file)
  }

  if (photoUrl) {
    return (
      <div className="group relative aspect-square w-full overflow-hidden rounded-lg border border-border/50 bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt="Body photo preview"
          className="h-full w-full object-cover"
        />
        {!disabled && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-background/80 p-1.5 text-foreground opacity-0 shadow transition-opacity group-hover:opacity-100"
            aria-label="Remove photo"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled && !uploading) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && !uploading && inputRef.current?.click()}
      className={[
        'flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border/60 bg-muted/30 hover:border-border hover:bg-muted/60',
        (disabled || uploading) ? 'pointer-events-none opacity-60' : '',
      ].join(' ')}
      role="button"
      tabIndex={0}
    >
      <Upload className="h-8 w-8 text-muted-foreground" />
      {uploading ? (
        <p className="text-sm text-muted-foreground">
          Uploading… {Math.round(uploadProgress)}%
        </p>
      ) : (
        <>
          <p className="text-sm font-medium">
            Drag &amp; drop your photo here
          </p>
          <p className="text-xs text-muted-foreground">
            or click to browse · max {MAX_MB}MB · JPG/PNG/WebP
          </p>
        </>
      )}
      {localError && (
        <p className="mt-1 text-xs text-destructive">{localError}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_UPLOAD_CONTENT_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) validateAndSubmit(file)
          // 重置避免选同一文件不触发 change
          e.target.value = ''
        }}
        disabled={disabled || uploading}
      />
    </div>
  )
}
```

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/image-uploader.tsx
git commit -m "feat: 添加 ImageUploader 拖拽上传组件"
```

---

## Task 6: useGeneration hook（核心）

**Files:**
- Create: `src/hooks/use-generation.ts`

- [ ] **Step 1: 创建 hook 文件**

文件内容：

```typescript
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GenerateImage,
  GenerateResponse,
  UploadUrlResponse,
} from '@/types'

export type GenStatus =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'generating'
  | 'completed'
  | 'error'

export type GenState = {
  status: GenStatus
  uploadProgress: number
  generateProgress: number
  stageLabel: string
  elapsedSeconds: number
  photoKey: string | null
  photoUrl: string | null
  prompt: string
  result: GenerateResponse | null
  /** 4 张全失败时为 true（后端已退款） */
  refunded: boolean
  error: string | null
}

const INITIAL_STATE: GenState = {
  status: 'idle',
  uploadProgress: 0,
  generateProgress: 0,
  stageLabel: '',
  elapsedSeconds: 0,
  photoKey: null,
  photoUrl: null,
  prompt: '',
  result: null,
  refunded: false,
  error: null,
}

/** 假进度推进时间表（基于 Day 3 实测耗时） */
const STAGE1_END_SEC = 110      // 0-110s: Step 1（纹身图案生成）
const STAGE2_END_SEC = 250      // 110-250s: Step 2（4 部位融合）
const PROGRESS_CAP = 95         // 不冲到 100%，避免假象

function computeStage(elapsedSec: number): { label: string; progress: number } {
  if (elapsedSec < STAGE1_END_SEC) {
    const ratio = elapsedSec / STAGE1_END_SEC
    return { label: 'Step 1: Designing your tattoo', progress: ratio * 45 }
  }
  if (elapsedSec < STAGE2_END_SEC) {
    const ratio = (elapsedSec - STAGE1_END_SEC) / (STAGE2_END_SEC - STAGE1_END_SEC)
    return { label: 'Step 2: Placing on body (4 parts in parallel)', progress: 45 + ratio * 45 }
  }
  return { label: 'Almost there, finalizing...', progress: PROGRESS_CAP }
}

export function useGeneration() {
  const [state, setState] = useState<GenState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedStartRef = useRef<number>(0)

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    // 卸载时清理
    return () => {
      clearTimers()
      abortRef.current?.abort()
    }
  }, [clearTimers])

  const setPrompt = useCallback((prompt: string) => {
    setState((s) => ({ ...s, prompt }))
  }, [])

  const uploadPhoto = useCallback(async (file: File) => {
    setState((s) => ({
      ...s,
      status: 'uploading',
      uploadProgress: 0,
      error: null,
      result: null,
      refunded: false,
    }))

    // 客户端预检（双保险，组件层已检过）
    if (file.size > 10 * 1024 * 1024) {
      setState((s) => ({ ...s, status: 'ready', error: 'File too large (max 10MB)' }))
      throw new Error('File too large (max 10MB)')
    }

    // Step A: 拿预签名 URL
    let uploadRes: UploadUrlResponse
    try {
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
          contentLength: file.size,
          ext: file.type.split('/')[1] || 'jpg',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload URL request failed (HTTP ${res.status})`)
      }
      uploadRes = (await res.json()) as UploadUrlResponse
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, status: 'idle', error: msg }))
      throw e
    }

    // Step B: PUT 到 R2，用 XMLHttpRequest 拿 progress
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = (e.loaded / e.total) * 100
            setState((s) => ({ ...s, uploadProgress: pct }))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`R2 upload failed (HTTP ${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('R2 upload network error'))
        xhr.open('PUT', uploadRes.uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, status: 'idle', error: msg }))
      throw e
    }

    setState((s) => ({
      ...s,
      status: 'ready',
      uploadProgress: 100,
      photoKey: uploadRes.key,
      photoUrl: uploadRes.publicUrl,
    }))
  }, [])

  const generate = useCallback(async () => {
    const current = stateRef.current
    if (!current.photoKey || !current.photoUrl) {
      const msg = 'Photo is required'
      setState((s) => ({ ...s, error: msg }))
      throw new Error(msg)
    }
    if (!current.prompt.trim()) {
      const msg = 'Prompt is required'
      setState((s) => ({ ...s, error: msg }))
      throw new Error(msg)
    }

    // 启动进度计时器
    clearTimers()
    elapsedStartRef.current = Date.now()
    progressTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - elapsedStartRef.current) / 1000)
      const { label, progress } = computeStage(elapsed)
      setState((s) => ({
        ...s,
        elapsedSeconds: elapsed,
        stageLabel: label,
        generateProgress: progress,
      }))
    }, 1000)

    setState((s) => ({
      ...s,
      status: 'generating',
      generateProgress: 0,
      elapsedSeconds: 0,
      stageLabel: 'Step 1: Designing your tattoo',
      error: null,
      result: null,
      refunded: false,
    }))

    // AbortController 15 分钟超时兜底
    abortRef.current = new AbortController()
    const timeoutId = setTimeout(() => abortRef.current?.abort(), 15 * 60 * 1000)

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

      const data: GenerateResponse = await res.json().catch(() => ({
        projectId: '',
        tattooDesignUrl: '',
        images: [] as GenerateImage[],
        error: 'Invalid server response',
      }))

      if (!res.ok) {
        throw new Error(data.error || `Generation failed (HTTP ${res.status})`)
      }

      // 4 张全失败的语义判定
      const allFailed =
        data.images.length > 0 && data.images.every((img) => img.status === 'failed')

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
    } finally {
      clearTimeout(timeoutId)
    }
  }, [clearTimers])

  const reset = useCallback(() => {
    clearTimers()
    abortRef.current?.abort()
    setState(INITIAL_STATE)
  }, [clearTimers])

  /** 清空照片但保留 prompt（用于 "Try another idea"） */
  const resetPhoto = useCallback(() => {
    clearTimers()
    setState((s) => ({
      ...INITIAL_STATE,
      prompt: s.prompt,
    }))
  }, [clearTimers])

  // stateRef 让 generate 能读到最新状态（避免 stale closure）
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  return {
    ...state,
    setPrompt,
    uploadPhoto,
    generate,
    reset,
    resetPhoto,
  }
}
```

> **说明**：`stateRef` 模式用于让 `generate` 内部读到最新的 `photoKey` / `prompt`。如果不这么做，闭包会捕获旧值。

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-generation.ts
git commit -m "feat: 添加 useGeneration hook 含状态机和假进度"
```

---

## Task 7: GenerationProgress 组件

**Files:**
- Create: `src/components/generation-progress.tsx`

- [ ] **Step 1: 创建组件**

文件内容：

```typescript
'use client'

import { Check, Loader2 } from 'lucide-react'

type Props = {
  progress: number        // 0-100
  stageLabel: string
  elapsedSeconds: number
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

/**
* 生成进度展示：阶段标签 + 进度条 + 已耗时。
* 阶段标签由父组件传入（来自 useGeneration 的 stageLabel）。
*/
export function GenerationProgress({ progress, stageLabel, elapsedSeconds }: Props) {
  const inStep1 = stageLabel.startsWith('Step 1')
  const inStep2 = stageLabel.startsWith('Step 2')
  const isFinalizing = !inStep1 && !inStep2

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-card p-6">
      <div className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <h3 className="text-base font-semibold">Generating your tattoo preview...</h3>
      </div>

      <div className="flex flex-col gap-2">
        <StepRow
          label="Step 1: Designing your tattoo"
          state={inStep1 ? 'active' : inStep2 || isFinalizing ? 'done' : 'pending'}
        />
        <StepRow
          label="Step 2: Placing on body (4 parts in parallel)"
          state={inStep2 ? 'active' : isFinalizing ? 'done' : 'pending'}
        />
        {isFinalizing && (
          <StepRow label={stageLabel} state="active" />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Usually takes 3–5 minutes · Keep this tab open.
      </p>
    </div>
  )
}

function StepRow({
  label,
  state,
}: {
  label: string
  state: 'pending' | 'active' | 'done'
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {state === 'done' ? (
        <Check className="h-4 w-4 text-primary" />
      ) : state === 'active' ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <span className="h-4 w-4 rounded-full border border-border" />
      )}
      <span className={state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}>
        {label}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/generation-progress.tsx
git commit -m "feat: 添加 GenerationProgress 多阶段进度组件"
```

---

## Task 8: GenerationResults 组件

**Files:**
- Create: `src/components/generation-results.tsx`

- [ ] **Step 1: 创建组件**

文件内容：

```typescript
'use client'

import { useState } from 'react'
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { BODY_PART_LABELS, type BodyPart } from '@/lib/constants'
import type { GenerateImage } from '@/types'

type Props = {
  tattooDesignUrl: string
  images: GenerateImage[]
  refunded?: boolean
  onRegenerate: () => void
  onReset: () => void
}

/**
* 结果展示：
* - 顶部 Step 1 纹身设计稿大图
* - 下方 4 部位 2x2 网格（失败部位显示占位）
* - 点击成功图弹出 Dialog 放大
*/
export function GenerationResults({
  tattooDesignUrl,
  images,
  refunded,
  onRegenerate,
  onReset,
}: Props) {
  const [zoom, setZoom] = useState<{ url: string; title: string } | null>(null)

  const successCount = images.filter((i) => i.status === 'completed').length

  return (
    <div className="flex flex-col gap-6">
      {refunded && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">All 4 body parts failed</p>
            <p className="text-xs">Your credits have been refunded. Please try again.</p>
          </div>
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Your Tattoo Design</h3>
        </div>
        <button
          type="button"
          onClick={() => setZoom({ url: tattooDesignUrl, title: 'Tattoo Design' })}
          className="group block w-full overflow-hidden rounded-lg border border-border/50 bg-muted"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={tattooDesignUrl}
            alt="Generated tattoo design"
            className="aspect-square w-full object-contain transition-transform group-hover:scale-[1.01]"
          />
        </button>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Placed on 4 body parts</h3>
          <span className="text-xs text-muted-foreground">
            {successCount}/{images.length} succeeded · click to zoom
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {images.map((img) => (
            <ResultCell
              key={img.bodyPart}
              image={img}
              onZoom={(url, title) => setZoom({ url, title })}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onRegenerate} variant="default" className="sm:flex-1">
          <RotateCcw className="mr-2 h-4 w-4" />
          Try another idea
        </Button>
        <Button onClick={onReset} variant="outline" className="sm:flex-1">
          Start over
        </Button>
      </div>

      <Dialog open={zoom !== null} onOpenChange={(open) => !open && setZoom(null)}>
        <DialogContent className="max-w-3xl bg-background p-2 sm:p-3">
          <DialogTitle className="sr-only">
            {zoom?.title ?? 'Image preview'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enlarged preview of the generated tattoo image.
          </DialogDescription>
          {zoom && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={zoom.url}
              alt={zoom.title}
              className="h-auto w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ResultCell({
  image,
  onZoom,
}: {
  image: GenerateImage
  onZoom: (url: string, title: string) => void
}) {
  const label = BODY_PART_LABELS[image.bodyPart as BodyPart] ?? image.bodyPart

  if (image.status !== 'completed' || !image.url) {
    return (
      <div className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border border-border/50 bg-muted p-4 text-center">
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">This part failed</p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onZoom(image.url!, label)}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/50 bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.url}
        alt={`Tattoo on ${label}`}
        className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
      />
      <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">
        {label}
      </span>
    </button>
  )
}
```

- [ ] **Step 2: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/generation-results.tsx
git commit -m "feat: 添加 GenerationResults 结果网格组件"
```

---

## Task 9: TattooGenerator 主组件

**Files:**
- Create: `src/components/tattoo-generator.tsx`

- [ ] **Step 1: 创建主组件**

文件内容：

```typescript
'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditsBadge } from '@/components/credits-badge'
import { ImageUploader } from '@/components/image-uploader'
import { GenerationProgress } from '@/components/generation-progress'
import { GenerationResults } from '@/components/generation-results'
import { useCredits } from '@/hooks/use-credits'
import { useGeneration } from '@/hooks/use-generation'
import { CREDITS_PER_GENERATION } from '@/lib/constants'

/**
* 纹身生成器主组件：上传 → 输入 → 生成 → 结果。
* 持有状态机（来自 useGeneration）+ 余额（来自 useCredits）。
*/
export function TattooGenerator() {
  const credits = useCredits()
  const gen = useGeneration()

  // 错误 → toast（去重避免重复弹相同错误）
  const lastErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gen.error) return
    if (lastErrorRef.current === gen.error) return
    lastErrorRef.current = gen.error
    toast.error(gen.error)
  }, [gen.error])

  // 完成时刷新 credits（无论成功失败，因为可能扣过 / 退过）
  useEffect(() => {
    if (gen.status === 'completed' || gen.status === 'error') {
      credits.refresh()
    }
    // 故意不依赖 credits.refresh（避免 refresh 改变导致重复请求）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status])

  async function handleFile(file: File) {
    try {
      await gen.uploadPhoto(file)
      toast.success('Photo uploaded')
    } catch {
      // 错误已通过 gen.error → toast 展示
    }
  }

  async function handleGenerate() {
    if (credits.credits === null) {
      toast.error('Loading credits, please wait a moment')
      return
    }
    if (credits.credits < CREDITS_PER_GENERATION) {
      toast.error("You're out of credits. Pricing is coming soon.")
      return
    }
    try {
      await gen.generate()
    } catch {
      // 错误已通过 gen.error → toast 展示
    }
  }

  // generating 中：渲染进度
  if (gen.status === 'generating') {
    return (
      <div className="flex flex-col gap-4">
        <Header credits={credits.credits} creditsLoading={credits.loading} />
        <GenerationProgress
          progress={gen.generateProgress}
          stageLabel={gen.stageLabel}
          elapsedSeconds={gen.elapsedSeconds}
        />
      </div>
    )
  }

  // completed 或 error（有结果）：渲染结果
  if (gen.result && (gen.status === 'completed' || gen.status === 'error')) {
    return (
      <div className="flex flex-col gap-4">
        <Header credits={credits.credits} creditsLoading={credits.loading} />
        <GenerationResults
          tattooDesignUrl={gen.result.tattooDesignUrl}
          images={gen.result.images}
          refunded={gen.refunded}
          onRegenerate={gen.resetPhoto}
          onReset={gen.reset}
        />
      </div>
    )
  }

  // idle / uploading / ready：渲染表单
  const ready = gen.status === 'ready' || (gen.status === 'uploading' && gen.photoUrl !== null)
  return (
    <div className="flex flex-col gap-4">
      <Header credits={credits.credits} creditsLoading={credits.loading} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate your tattoo preview
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">1. Upload your photo</label>
              <ImageUploader
                photoUrl={gen.photoUrl}
                uploading={gen.status === 'uploading'}
                uploadProgress={gen.uploadProgress}
                onFileSelected={handleFile}
                onClear={gen.resetPhoto}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">2. Describe your tattoo idea</label>
              <Textarea
                value={gen.prompt}
                onChange={(e) => gen.setPrompt(e.target.value)}
                placeholder="e.g. A dragon in Japanese irezumi style, bold black lines with red accents"
                rows={6}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                {gen.prompt.length}/500 characters
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Cost: <span className="font-medium text-foreground">{CREDITS_PER_GENERATION} credit</span> · 4 previews (left arm, right arm, shoulder, calf)
            </p>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!ready || !gen.prompt.trim() || gen.status === 'uploading'}
              className="sm:min-w-[180px]"
            >
              {gen.status === 'uploading' ? 'Uploading...' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Header({
  credits,
  creditsLoading,
}: {
  credits: number | null
  creditsLoading: boolean
}) {
  return (
    <div className="flex justify-end">
      <CreditsBadge credits={credits} loading={creditsLoading} />
    </div>
  )
}
```

- [ ] **Step 2: 确认 Shadcn Card 导出名**

Run: `cat src/components/ui/card.tsx`（用 Read 工具）
Expected: 确认导出 `Card` / `CardContent` / `CardHeader` / `CardTitle`
若实际未导出 `CardHeader` / `CardTitle`，移除对应 import 与 JSX，直接在 `<Card>` 内用普通 div + className

- [ ] **Step 3: 编译检查**

Run: `npx tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add src/components/tattoo-generator.tsx
git commit -m "feat: 添加 TattooGenerator 主组件串联上传/生成/结果"
```

---

## Task 10: 更新首页

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: 改写 page.tsx**

完整文件内容（替换）：

```typescript
import { SignInButton, Show } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { TattooGenerator } from '@/components/tattoo-generator'

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          See Your Tattoo Before You Ink
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
          Upload a photo, describe your idea, and let AI preview the tattoo on
          your arm, shoulder, and calf.
        </p>

        <Show when="signed-out">
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button size="lg">Try it free</Button>
            </SignInButton>
            <Button size="lg" variant="outline">
              See examples
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            1 free generation on sign up · No credit card required
          </p>
        </Show>
      </section>

      <Show when="signed-in">
        <div className="mt-10">
          <TattooGenerator />
        </div>
      </Show>
    </div>
  )
}
```

- [ ] **Step 2: 编译检查 + 启动 dev server**

Run: `npx tsc --noEmit && npm run dev`
Expected: 无 TS 错误；dev server 启动后 `http://localhost:3000` 返回 200

- [ ] **Step 3: 手动检查页面结构**

未登录访问首页：
Expected: 看到 Hero + "Try it free" + "See examples" 按钮，**不**渲染生成器

登录后访问首页：
Expected: 看到 Hero（无 CTA）+ Generator Card（含上传区 + prompt 输入 + Generate 按钮 + Credits 徽章）

- [ ] **Step 4: 移动端响应式检查**

浏览器 DevTools → Toggle device toolbar → 选 iPhone 12（390x844）：
Expected:
- Hero 字号正常（不溢出）
- Generator Card 单列堆叠（上传区在上，prompt 在下）
- 2x2 结果网格保持 2 列（在更窄屏如 320px 也保持 2 列，每格缩小）

如有溢出，调整 Tailwind 断点（`sm:` / `md:`）。

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: 首页嵌入 TattooGenerator 组件"
```

---

## Task 11: 端到端验证 + 更新交接文档

**Files:**
- Modify: `docs/handoff.md`

- [ ] **Step 1: 全量编译 + Lint**

Run: `npm run build && npm run lint`
Expected:
- build 成功（已有 middleware 弃用警告，正常）
- lint 无错误（warning 可接受）

如有错误，先修复再继续。

- [ ] **Step 2: 端到端手动验证**

启动 dev server，登录账号（确保 credits ≥ 1），按下面流程跑一遍：

| 步骤 | 期望 |
|---|---|
| 1. 访问 `/` | Hero + Generator Card 显示 |
| 2. 拖一张 >10MB 的图 | toast "File too large"，不上传 |
| 3. 拖一张 .gif | toast "Unsupported file type" |
| 4. 拖一张正常 JPG | 显示进度 0→100%，缩略图出现，toast "Photo uploaded" |
| 5. prompt 留空点 Generate | 按钮 disabled，不触发 |
| 6. 输入 "dragon japanese style" 点 Generate | 切换到 generating，进度条推进，阶段标签更新 |
| 7. 等 3-9 分钟 | 切换到 completed，显示设计稿 + 2x2 部位图 |
| 8. 点 Step 1 设计稿 | Dialog 弹出大图 |
| 9. 点任一部位图 | Dialog 弹出大图 |
| 10. 检查 credits 徽章 | 从 1 变 0 |
| 11. 再点 Generate | toast "out of credits, Pricing coming soon" |
| 12. 点 "Try another idea" | 回到表单，prompt 保留，照片清空 |
| 13. 点 "Start over" | 回到初始 idle |

如果某部位失败：
- 失败 cell 显示 "This part failed" 占位
- 不可点击放大
- credits 不退（≥1 张成功）

如果 4 张全失败：
- 顶部红色提示 "All 4 body parts failed, credits refunded"
- credits 徽章刷新后回到 1

- [ ] **Step 3: 更新 handoff.md**

修改 `docs/handoff.md`：

(a) 更新顶部进度行：
```
> 当前进度：**Day 1 + Day 2 + Day 3 + Day 4 已完成，准备进入 Day 5**
```

(b) 更新 §2 进度总览表，把 Day 4 标 ✅，Day 5 标 ⏳ 下一步

(c) 在 §3 Git 历史顶部加 Day 4 commit hashes（用 `git log --oneline -10` 获取）

(d) 在 §6 文件结构里加上 Day 4 新增的文件：
```
src/
├── app/
│   └── api/
│       └── credits/route.ts             # POST 返回余额（Day 4）
├── components/
│   ├── tattoo-generator.tsx             # Day 4 主组件
│   ├── image-uploader.tsx               # Day 4 上传组件
│   ├── generation-progress.tsx          # Day 4 进度展示
│   ├── generation-results.tsx           # Day 4 结果网格
│   └── credits-badge.tsx                # Day 4 余额徽章
├── hooks/                                # Day 4 新目录
│   ├── use-credits.ts
│   └── use-generation.ts
```

(e) 在 §8 加新章节 "8.5 Day 4 完成回顾 + Day 5 准备清单"，内容：
- Day 4 已完成事项（列出新文件）
- 实际遇到的坑（如有）
- Day 5 要做的：Stripe / pricing 页面 / webhook
- Day 5 开始前用户需要确认：
  - [ ] Stripe 账户已注册
  - [ ] 拿到 `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  - [ ] 准备用测试卡 `4242 4242 4242 4242` 跑支付

(f) 更新 §10 已知问题表（如有新发现的坑）

- [ ] **Step 4: Commit 交接文档**

```bash
git add docs/handoff.md
git commit -m "docs: 更新交接文档，Day 4 完成，准备 Day 5"
```

---

## 验收清单（全部 Task 完成后）

对照 spec §12 验收标准逐项确认：

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
- [ ] "Try another idea" 保留 prompt，清空照片
- [ ] "Start over" 全部重置回 idle
- [ ] 移动端单列布局基本可用，不崩

---

## 风险与备注

| 风险 | 应对 |
|---|---|
| Vercel Hobby 10s 超时（Day 7 部署后才暴露） | Day 7 升级 Pro 或改异步；Day 4 本地 dev 不受影响 |
| 浏览器/代理对长 fetch 的处理差异 | AbortController 15min 兜底；进度条卡在 95% 提示耐心等待 |
| 用户刷新页面丢失生成中状态 | MVP 不处理；Day 6 加 /history 后可从历史找回 |
| `CardContent` 等 Shadcn 导出名差异 | Task 9 Step 2 已加校验步骤 |
| 假进度与真实进度差距大 | 上限 95% + "Usually takes 3-5 minutes" 文案兜底 |
