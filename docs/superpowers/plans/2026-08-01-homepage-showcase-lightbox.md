# 首页 Showcase + 全屏 Lightbox 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐 task 执行。步骤用 `- [ ]` 复选框跟踪。
>
> **依据**：`docs/superpowers/specs/2026-08-01-homepage-showcase-lightbox-design.md`（已与用户确认）。

**Goal:** 给首页加 showcase 示例图区 + 把图片弹窗改成全屏 Lightbox，并修好 "See examples" 装饰按钮。

**Architecture:** 新建统一 `<Lightbox>` 全屏组件（基于 base-ui `Dialog` primitive，三处复用），替换生成结果 / 历史里的 `max-w-3xl` 卡片 Dialog；首页加 `<Showcase>` 3 列网格（仅 signed-out），"See examples" 改锚点滚动；新建 `gen-showcase.mjs` 脚本用 KIE + Unsplash 无脸身体照生成 8 张示例图落 R2。

**Tech Stack:** Next.js 16.2.10、React 19、base-ui（`@base-ui/react/dialog`）、Tailwind v4、KIE gpt-image-2、Cloudflare R2。

## Global Constraints

- 所有回答与 **commit message 用中文**（`CLAUDE.md`）；每个 commit 末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **项目无测试框架**：验证用 `npm run lint` + `npm run build` + 手动，**不强加 unit test**。
- base-ui Dialog primitive 从 `@base-ui/react/dialog` import（参考 `src/components/ui/dialog.tsx`），用 `Dialog.Root / Portal / Backdrop / Popup / Title / Description / Close`。
- Lightbox 是 Client Component（'use client'）；showcase 数据文件 `src/lib/showcase-examples.ts` 是纯数据（不依赖 env / R2 SDK，Client 可 import）；URL 解析在 `page.tsx`（Server）用 `getPublicUrl`。
- 示例图源：**Unsplash 无脸局部身体照**（只拍手臂/腿/肩，不含头）+ KIE 生成；不用真实用户数据。
- showcase 仅在 `<Show when="signed-out">` 内渲染。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/components/lightbox.tsx` | **新建** | 全屏 Lightbox（受控：images/index/onClose/onIndexChange） |
| `src/components/generation-results.tsx` | **修改** | zoom state → lightboxIndex；Dialog → Lightbox（支持设计稿+部位切换） |
| `src/components/history-image-dialog.tsx` | **修改** | Dialog → Lightbox（保留 openIndex + 映射逻辑） |
| `src/lib/showcase-examples.ts` | **新建** | 纯数据：`{ key, alt }[]`（8 条） |
| `src/components/showcase.tsx` | **新建** | Client：3 列网格 + 内置 Lightbox |
| `src/app/page.tsx` | **修改** | import Showcase + 数据；"See examples" 改 Link 锚点；signed-out 渲染 Showcase |
| `src/app/globals.css` | **修改** | `html` 加 `scroll-behavior: smooth` |
| `scripts/gen-showcase.mjs` | **新建** | 生成 8 张示例图到 R2 `showcase/` |

---

## Task 1: 新建 `<Lightbox>` 全屏组件

**Files:** Create `src/components/lightbox.tsx`

**Interfaces:**
- Produces: `LightboxImage = { url: string; alt: string }` 类型 + `Lightbox` 组件（props 见下）。Task 2/3/4 消费。

- [ ] **Step 1: 新建 `src/components/lightbox.tsx`，写入完整内容**

```tsx
'use client'

import { useEffect } from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export type LightboxImage = { url: string; alt: string }

interface LightboxProps {
  images: LightboxImage[]
  /** 当前展示索引；null = 关闭 */
  index: number | null
  onClose: () => void
  onIndexChange: (i: number) => void
}

/**
 * 全屏图片浏览（占满浏览器）。
 * - 深色背景 + 图片 object-contain 居中（完整不裁剪）
 * - Esc / 点击图片外 / X 按钮关闭
 * - 多图时 ←/→ 键 + 箭头切换，循环；底部 N/M 计数
 * - 受控：父组件管 index
 */
export function Lightbox({ images, index, onClose, onIndexChange }: LightboxProps) {
  const open = index !== null
  const current = open ? images[index] : null

  const goPrev = () => {
    if (index === null) return
    onIndexChange((index - 1 + images.length) % images.length)
  }
  const goNext = () => {
    if (index === null) return
    onIndexChange((index + 1) % images.length)
  }

  // 键盘 ←/→（多图时）
  useEffect(() => {
    if (!open || images.length <= 1) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, images.length])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50" />
        <Dialog.Popup
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 outline-none"
          onClick={(e) => {
            // 点击图片外的背景区域关闭
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <Dialog.Title className="sr-only">
            {current?.alt ?? 'Image preview'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Use left and right arrow keys to navigate. Press Escape to close.
          </Dialog.Description>

          {current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}

          {/* 关闭 */}
          <Dialog.Close
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </Dialog.Close>

          {/* 切换（多图） */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next image"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                {(index ?? 0) + 1} / {images.length}
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

> 注：base-ui `Dialog.Popup` 透传 `onClick` 到 DOM；`Dialog.Close` 点击自动触发 `onOpenChange(false)` → `onClose`；`Dialog.Root` 默认处理 `Esc` 关闭 + 聚焦陷阱。若实施时发现 `Popup` 的 `onClick` 不触发，改用 `onPointerDown` 或给图片加 `pointer-events-auto` + Popup `pointer-events-none` 让点击穿透到 Backdrop。

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/components/lightbox.tsx
git commit -m "feat: 新建全屏 Lightbox 组件（base-ui Dialog primitive）

统一图片浏览：黑底 contain 居中、Esc/点击外/X 关闭、←/→ 键+箭头循环切换、
N/M 计数。受控组件（images/index/onClose/onIndexChange），供生成结果/历史/
showcase 三处复用。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 生成结果 `GenerationResults` 接入 Lightbox

**Files:** Modify `src/components/generation-results.tsx`

**Interfaces:**
- Consumes: `Lightbox`, `LightboxImage`（Task 1）。
- Produces: `GenerationResults` 行为不变（对外 props 不变），内部 Dialog → Lightbox，并支持设计稿+部位切换。

- [ ] **Step 1: 改 import —— 加 Lightbox，去掉 Dialog 相关**

把原 import 块里的 Dialog 部分：
```tsx
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
```
替换为：
```tsx
import { Lightbox, type LightboxImage } from '@/components/lightbox'
```
（`BODY_PART_LABELS` / `BodyPart` / `Button` / lucide 图标 import 保留不动。）

- [ ] **Step 2: 替换 state（`zoom` → `lightboxIndex`）+ 构建 images/映射**

把：
```tsx
  const [zoom, setZoom] = useState<{ url: string; title: string } | null>(null)

  const successCount = images.filter((i) => i.status === 'completed').length
```
替换为：
```tsx
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const successCount = images.filter((i) => i.status === 'completed').length

  // Lightbox 图片列表：设计稿 + 成功部位；记录每个 bodyPart 在列表里的索引（失败=-1）
  const lightboxImages: LightboxImage[] = [
    { url: tattooDesignUrl, alt: 'Generated tattoo design' },
  ]
  const partLightboxIndex: number[] = images.map((img) => {
    if (img.status === 'completed' && img.url) {
      const idx = lightboxImages.length
      lightboxImages.push({
        url: img.url,
        alt: `Tattoo on ${BODY_PART_LABELS[img.bodyPart as BodyPart] ?? img.bodyPart}`,
      })
      return idx
    }
    return -1
  })
```

- [ ] **Step 3: 设计稿按钮 onClick 改 `setLightboxIndex(0)`**

把：
```tsx
          onClick={() => setZoom({ url: tattooDesignUrl, title: 'Tattoo Design' })}
```
替换为：
```tsx
          onClick={() => setLightboxIndex(0)}
```

- [ ] **Step 4: 部位网格的 `onZoom` 改用映射后的 index**

把：
```tsx
            <ResultCell
              key={img.bodyPart}
              image={img}
              onZoom={(url, title) => setZoom({ url, title })}
            />
```
替换为：
```tsx
            <ResultCell
              key={img.bodyPart}
              image={img}
              onZoom={() => {
                const idx = partLightboxIndex[i]
                if (idx >= 0) setLightboxIndex(idx)
              }}
            />
```
> 注意：`.map((img, i) => ...)` 要带索引 `i`——当前代码是 `images.map((img) =>`，需改成 `images.map((img, i) =>`。

- [ ] **Step 5: `ResultCell` 的 `onZoom` 签名简化为 `() => void`**

把：
```tsx
function ResultCell({
  image,
  onZoom,
}: {
  image: GenerateImage
  onZoom: (url: string, title: string) => void
}) {
```
替换为：
```tsx
function ResultCell({
  image,
  onZoom,
}: {
  image: GenerateImage
  onZoom: () => void
}) {
```
并把 `ResultCell` 内成功分支里的：
```tsx
      onClick={() => onZoom(image.url!, label)}
```
替换为：
```tsx
      onClick={onZoom}
```

- [ ] **Step 6: 把整段 `<Dialog>...</Dialog>` 替换为 `<Lightbox />`**

把文件末尾的整个 Dialog 块：
```tsx
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
```
替换为：
```tsx
      <Lightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
```

- [ ] **Step 7: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。`useState` 仍被用（`lightboxIndex`），无未使用 import（`Dialog*` 已删）。

- [ ] **Step 8: Commit**

```bash
git add src/components/generation-results.tsx
git commit -m "feat: 生成结果弹窗改全屏 Lightbox（支持设计稿+部位切换）

zoom 单图 state → lightboxIndex；max-w-3xl Dialog → Lightbox。
顺带改进：原只能看单图，现在可在 Lightbox 里 ←/→ 切换浏览设计稿+所有成功部位。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: 历史 `HistoryImageDialog` 接入 Lightbox

**Files:** Modify `src/components/history-image-dialog.tsx`

**Interfaces:**
- Consumes: `Lightbox`, `LightboxImage`（Task 1）。
- Produces: 对外 props 不变；内部 Dialog → Lightbox，切换逻辑（含 `bodyPartDialogIndex`）保留。

- [ ] **Step 1: 改 import**

把：
```tsx
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
```
替换为：
```tsx
import { Lightbox, type LightboxImage } from '@/components/lightbox'
```
（`useState` / `ChevronLeft` / `ChevronRight` 保留——仍用于其他地方？检查：`ChevronLeft/Right` 改后不再用，删除。`useState` 仍用于 `openIndex`。）

> 实际上 Step 2 删除 `goPrev/goNext` 后，`ChevronLeft/ChevronRight` 不再被引用。把 import 行改成只留 `useState`：
> ```tsx
> import { useState } from 'react'
> ```
> （删除 `ChevronLeft, ChevronRight` 导入。）

- [ ] **Step 2: `DialogImage` 类型改用 `LightboxImage`，删 `goPrev/goNext`**

把：
```tsx
type DialogImage = { url: string; title: string }
```
替换为：
```tsx
// 复用 Lightbox 的图片类型（alt 取代 title）
type DialogImage = LightboxImage
```

把 images 构建里的 `title` 字段改为 `alt`：
```tsx
  const images: DialogImage[] = []
  const bodyPartDialogIndex: number[] = []
  if (tattooDesignUrl) {
    images.push({ url: tattooDesignUrl, alt: 'Tattoo Design' })
  }
  bodyParts.forEach((bp) => {
    if (bp.url) {
      bodyPartDialogIndex.push(images.length)
      images.push({ url: bp.url, alt: bp.label })
    } else {
      bodyPartDialogIndex.push(-1)
    }
  })
```

删掉 `goPrev` / `goNext` 两个函数（Lightbox 内部处理切换）：
```tsx
  const goPrev = () =>
    setOpenIndex((i) => (i === null ? null : (i - 1 + images.length) % images.length))
  const goNext = () =>
    setOpenIndex((i) => (i === null ? null : (i + 1) % images.length))
```
（整段删除。）

- [ ] **Step 3: 把整段 `<Dialog>...</Dialog>` 替换为 `<Lightbox />`**

把：
```tsx
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
```
替换为：
```tsx
      <Lightbox
        images={images}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
      />
```

- [ ] **Step 4: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。无 `Dialog*` / `ChevronLeft/Right` / `goPrev/goNext` 残留引用。

- [ ] **Step 5: Commit**

```bash
git add src/components/history-image-dialog.tsx
git commit -m "refactor: 历史图片弹窗改用统一 Lightbox

max-w-3xl Dialog → Lightbox；切换逻辑（含 bodyPartDialogIndex 失败跳过映射）
交给 Lightbox 内部。删除 goPrev/goNext 与自有箭头 UI。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 新建 showcase 数据文件 + `<Showcase>` 组件

**Files:**
- Create: `src/lib/showcase-examples.ts`
- Create: `src/components/showcase.tsx`

**Interfaces:**
- Consumes: `Lightbox`, `LightboxImage`（Task 1）。
- Produces: `SHOWCASE_EXAMPLES: { key: string; alt: string }[]`（Task 5 消费）+ `Showcase` 组件（props `{ images: LightboxImage[] }`）。

- [ ] **Step 1: 新建 `src/lib/showcase-examples.ts`**

```ts
/**
 * 首页 showcase 示例图数据（纯数据，不依赖 env / R2 SDK）。
 * key 对应 R2 对象 key（由 scripts/gen-showcase.mjs 生成到 showcase/<slug>.png）。
 * URL 由 page.tsx（Server）用 getPublicUrl(key) 解析，避免把 R2 SDK 带进 Client bundle。
 */
export type ShowcaseExample = { key: string; alt: string }

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  { key: 'showcase/dragon.png', alt: 'Dragon tattoo preview' },
  { key: 'showcase/rose.png', alt: 'Rose tattoo preview' },
  { key: 'showcase/koi.png', alt: 'Koi fish tattoo preview' },
  { key: 'showcase/skull.png', alt: 'Skull tattoo preview' },
  { key: 'showcase/mandala.png', alt: 'Mandala tattoo preview' },
  { key: 'showcase/snake.png', alt: 'Snake tattoo preview' },
  { key: 'showcase/butterfly.png', alt: 'Butterfly tattoo preview' },
  { key: 'showcase/phoenix.png', alt: 'Phoenix tattoo preview' },
]
```

- [ ] **Step 2: 新建 `src/components/showcase.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Lightbox, type LightboxImage } from '@/components/lightbox'

interface ShowcaseProps {
  images: LightboxImage[]
}

/**
 * 首页 showcase：3 列网格示例图，点击进全屏 Lightbox（串联切换）。
 * 仅在未登录落地页渲染（由 page.tsx 的 <Show when="signed-out"> 控制）。
 */
export function Showcase({ images }: ShowcaseProps) {
  const [index, setIndex] = useState<number | null>(null)

  return (
    <section id="examples" className="mt-20 scroll-mt-20">
      <div className="mx-auto max-w-5xl px-4">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Real tattoo previews
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
          Generated by AI · click to enlarge
        </p>

        <div className="mt-8 grid grid-cols-3 gap-3 sm:gap-4">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={img.alt}
              className="group relative block aspect-[3/4] overflow-hidden rounded-lg bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt}
                className="h-full w-full cursor-zoom-in object-cover transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </button>
          ))}
        </div>
      </div>

      <Lightbox
        images={images}
        index={index}
        onClose={() => setIndex(null)}
        onIndexChange={setIndex}
      />
    </section>
  )
}
```

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。（此时 page.tsx 还没引用 Showcase，但组件本身能通过类型检查。）

- [ ] **Step 4: Commit**

```bash
git add src/lib/showcase-examples.ts src/components/showcase.tsx
git commit -m "feat: 新建 showcase 数据文件与 Showcase 组件

- showcase-examples.ts：8 条示例图 key+alt（纯数据，Client 可 import）
- showcase.tsx：3 列网格 + 内置 Lightbox，点击进全屏串联浏览

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 首页接入 Showcase + "See examples" 锚点 + 平滑滚动

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Consumes: `Showcase`（Task 4）、`SHOWCASE_EXAMPLES`（Task 4）、`getPublicUrl`（`@/lib/r2`，已存在）。

- [ ] **Step 1: 改 `src/app/page.tsx` import 块**

把：
```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { SignInButton, Show } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { TattooGenerator } from '@/components/tattoo-generator'
import { PaymentFeedback } from '@/components/payment-feedback'
```
替换为：
```tsx
import { Suspense } from 'react'
import Link from 'next/link'
import { SignInButton, Show } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { TattooGenerator } from '@/components/tattoo-generator'
import { PaymentFeedback } from '@/components/payment-feedback'
import { Showcase } from '@/components/showcase'
import { SHOWCASE_EXAMPLES } from '@/lib/showcase-examples'
import { getPublicUrl } from '@/lib/r2'

// Server 端解析示例图 URL（getPublicUrl 用 process.env.R2_PUBLIC_URL，
// 且 lib/r2.ts import 了 @aws-sdk/client-s3，不能进 Client bundle）
const showcaseImages = SHOWCASE_EXAMPLES.map((ex) => ({
  url: getPublicUrl(ex.key),
  alt: ex.alt,
}))
```

- [ ] **Step 2: "See examples" 按钮改锚点 Link**

把：
```tsx
            <Button size="lg" variant="outline">
              See examples
            </Button>
```
替换为：
```tsx
            <Button size="lg" variant="outline" render={<Link href="#examples" />}>
              See examples
            </Button>
```
> base-ui `Button` 透传 `render` prop（`src/components/ui/dialog.tsx:65` 已用此模式），把 Button 渲染成 `<Link>`，保留按钮样式 + 获得锚点跳转。

- [ ] **Step 3: signed-out 区块末尾加 `<Showcase>`**

把：
```tsx
        <Show when="signed-out">
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button size="lg">Try it free</Button>
            </SignInButton>
            <Button size="lg" variant="outline" render={<Link href="#examples" />}>
              See examples
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            1 free generation on sign up · No credit card required
          </p>
        </Show>
      </section>
```
替换为（在 `</Show>` 后、`</section>` 前加 Showcase？不——Showcase 应在 section 外、作为独立区块）：

把整段 signed-out 的 `<Show>...</Show>`（含两个按钮 + "1 free generation" 那段）替换为：
```tsx
        <Show when="signed-out">
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button size="lg">Try it free</Button>
            </SignInButton>
            <Button size="lg" variant="outline" render={<Link href="#examples" />}>
              See examples
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            1 free generation on sign up · No credit card required
          </p>
        </Show>
      </section>

      <Show when="signed-out">
        <Showcase images={showcaseImages} />
      </Show>
```
> 即：原 hero `</section>` 之后、signed-in `<Show>` 之前，插入一个 signed-out 的 `<Show><Showcase /></Show>`。

- [ ] **Step 4: `src/app/globals.css` 加平滑滚动**

把 `@layer base` 里的：
```css
  html {
    @apply font-sans;
  }
```
替换为：
```css
  html {
    @apply font-sans;
    scroll-behavior: smooth;
  }
```

- [ ] **Step 5: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。

- [ ] **Step 6: 手动验证（本地 `npm run dev`）**

- 未登录访问首页：看到 hero + "See examples" 按钮 + 下方 showcase 3 列网格（此时 R2 还没图，img 会 broken 显示 alt + bg-muted 占位，正常）。
- 点 "See examples" → 平滑滚动到 showcase 区。
- 点任一 showcase 图 → 全屏 Lightbox（黑底 contain），←/→ 切换、Esc/点击外/X 关闭。
- 登录后访问首页 → 不显示 showcase，直接是生成器。

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/app/globals.css
git commit -m "feat: 首页接入 showcase + See examples 锚点 + 平滑滚动

- page.tsx：signed-out 渲染 Showcase；'See examples' 改 Link 锚点 #examples
- globals.css：html 加 scroll-behavior: smooth
- 示例图 URL 在 Server 端用 getPublicUrl 解析（避免 R2 SDK 进 Client bundle）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 新建示例图生成脚本 `gen-showcase.mjs`

**Files:** Create `scripts/gen-showcase.mjs`

**Interfaces:**
- Produces: `node --env-file=.env.local scripts/gen-showcase.mjs` 生成 8 张图到 R2 `showcase/`。

> **设计偏离说明**：spec §6.1 提到"抽 `generateSingleFusion` 供脚本和应用复用"。实施时改为脚本内联 KIE 调用（与 `verify-day3.mjs` 同构），不抽 ts 函数——因为 `.mjs` 不能 import `.ts`，而为生成示例图装 `tsx` 不值得（YAGNI）。脚本是一次性工具，与应用层 `apply-to-body.ts` 各自独立。

- [ ] **Step 1: 新建 `scripts/gen-showcase.mjs`，写入完整内容**

```js
// 生成首页 showcase 示例图：8 个经典纹身题材 × 无脸身体照 → KIE 两步生成 → R2 showcase/
//
// 用法: node --env-file=.env.local scripts/gen-showcase.mjs
//
// 前置（二选一，在 BODY_PHOTOS 填好后再跑）：
//   A. 上传无脸局部身体照（只拍手臂/腿/肩，不含头）到 R2 showcase/body/，填 public URL
//   B. 直接填 Unsplash 直链 URL（无脸局部身体照，免费商用）
// 消耗：~48 KIE credits ≈ $0.24（8 × (text-to-image 6 + image-to-image 6)）

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const fail = (msg) => { console.error('❌', msg); process.exit(1) }
const ok = (msg) => console.log('✅', msg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const KIE_BASE_URL = process.env.KIE_BASE_URL || 'https://api.kie.ai'
const KIE_API_KEY = process.env.KIE_API_KEY
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
if (!KIE_API_KEY) fail('KIE_API_KEY 未配置（填到 .env.local）')
if (!R2_PUBLIC_URL) fail('R2_PUBLIC_URL 未配置')

/* 8 个示例（slug 与 src/lib/showcase-examples.ts 的 key 对应） */
const EXAMPLES = [
  { slug: 'dragon', prompt: 'dragon, japanese irezumi style, bold black lines with red accents' },
  { slug: 'rose', prompt: 'red rose with green leaves, old school traditional style' },
  { slug: 'koi', prompt: 'koi fish swimming upstream, japanese traditional, black and orange' },
  { slug: 'skull', prompt: 'skull with roses, black and grey realism' },
  { slug: 'mandala', prompt: 'mandala, symmetrical geometric, fine line blackwork' },
  { slug: 'snake', prompt: 'snake coiled around a dagger, traditional american' },
  { slug: 'butterfly', prompt: 'butterfly, watercolor style, vibrant' },
  { slug: 'phoenix', prompt: 'phoenix rising, japanese, black and red' },
]

/* 无脸身体照（长度 ≥ 1；少于 8 张则循环复用）。
   ⚠️ 跑脚本前在这里填好 URL（R2 showcase/body/* 或 Unsplash 直链）。 */
const BODY_PHOTOS = [
  // `${R2_PUBLIC_URL}/showcase/body/body-1.jpg`,
  // 'https://images.unsplash.com/photo-xxx?w=1024',
]
if (BODY_PHOTOS.length === 0) {
  fail('BODY_PHOTOS 为空：请上传无脸身体照到 R2 showcase/body/ 或填 Unsplash URL 后再跑')
}

/* ---- KIE 封装（与 src/server/ai/kie-client.ts 同构） ---- */
async function createTask(body) {
  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) fail(`createTask HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json()
  if (json.code !== 200 || !json.data?.taskId) fail(`createTask 失败: code=${json.code} msg=${json.msg}`)
  return json.data.taskId
}

async function getRecordInfo(taskId) {
  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${KIE_API_KEY}` },
  })
  if (!res.ok) fail(`recordInfo HTTP ${res.status}`)
  const json = await res.json()
  if (!json.data) fail(`recordInfo 空 data: ${JSON.stringify(json)}`)
  return json.data
}

function parseResultUrls(resultJson) {
  if (!resultJson) return []
  try {
    const parsed = JSON.parse(resultJson)
    return Array.isArray(parsed.resultUrls) ? parsed.resultUrls : []
  } catch {
    return []
  }
}

async function pollTask(taskId, { intervalMs = 2000, timeoutMs = 240_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let last
  let polls = 0
  while (Date.now() < deadline) {
    polls++
    const data = await getRecordInfo(taskId)
    last = data
    if (data.state === 'success') {
      process.stdout.write('\n')
      return { state: 'success', urls: parseResultUrls(data.resultJson), credits: data.creditsConsumed }
    }
    // 认 'fail'（实测）和 'failed'（防御）
    if (data.state === 'failed' || data.state === 'fail') {
      process.stdout.write('\n')
      return { state: 'failed', urls: [], failMsg: data.failMsg, credits: data.creditsConsumed }
    }
    process.stdout.write(`  [poll #${polls}] state=${data.state} progress=${data.progress ?? 'n/a'}%  \r`)
    await sleep(intervalMs)
  }
  console.error('\n最后一次 recordInfo:', JSON.stringify(last, null, 2))
  fail(`轮询超时（polls=${polls}），last state=${last?.state}`)
}

/* ---- R2 封装（与 src/lib/r2.ts fetchUrlAndUpload 同构） ---- */
function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  })
}

async function fetchAndUpload(sourceUrl, key) {
  const r = await fetch(sourceUrl)
  if (!r.ok) fail(`下载失败 ${sourceUrl}: HTTP ${r.status}`)
  const buf = await r.arrayBuffer()
  const contentType = r.headers.get('content-type')?.split(';')[0].trim() || 'image/png'
  await getR2().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: new Uint8Array(buf),
    ContentType: contentType,
  }))
  return `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
}

/* ---- 生成流程 ---- */
const FUSION_PROMPT = (desc) =>
  `Apply this tattoo design naturally on the body of the person in the photo. ` +
  `Make it look real with natural skin texture, lighting, perspective, and wrap slightly to follow the body contour. ` +
  `Do not change anything else in the photo. (design: ${desc})`

console.log('\n── 生成 showcase 示例图 ──')
console.log(`KIE_BASE_URL = ${KIE_BASE_URL}`)
console.log(`身体照数量 = ${BODY_PHOTOS.length}（将循环复用到 ${EXAMPLES.length} 个题材）`)

let totalCredits = 0
for (let i = 0; i < EXAMPLES.length; i++) {
  const { slug, prompt } = EXAMPLES[i]
  const bodyPhotoUrl = BODY_PHOTOS[i % BODY_PHOTOS.length]
  console.log(`\n[${i + 1}/${EXAMPLES.length}] ${slug}: ${prompt}`)

  // 1. text-to-image：生成纹身图案
  const designTaskId = await createTask({
    model: 'gpt-image-2-text-to-image',
    input: { prompt: `${prompt}, tattoo design, white background, clean bold lines, high contrast, stencil style`, aspect_ratio: '1:1' },
  })
  const design = await pollTask(designTaskId)
  if (design.state !== 'success' || design.urls.length === 0) fail(`${slug} 纹身图生成失败: ${design.failMsg}`)

  // 纹身图临时落 R2（作 image-to-image 输入）
  const designUrl = await fetchAndUpload(design.urls[0], `showcase/_tmp/${slug}-design-${Date.now()}.png`)

  // 2. image-to-image：融合到身体（3:4）
  const fusionTaskId = await createTask({
    model: 'gpt-image-2-image-to-image',
    input: { prompt: FUSION_PROMPT(prompt), input_urls: [bodyPhotoUrl, designUrl], aspect_ratio: '3:4' },
  })
  const fusion = await pollTask(fusionTaskId)
  if (fusion.state !== 'success' || fusion.urls.length === 0) fail(`${slug} 融合失败: ${fusion.failMsg}`)

  // 3. 最终图落到 R2 showcase/<slug>.png
  const finalUrl = await fetchAndUpload(fusion.urls[0], `showcase/${slug}.png`)
  totalCredits += (design.credits || 0) + (fusion.credits || 0)
  console.log(`  -> ${finalUrl} (credits: ${design.credits}+${fusion.credits})`)
  ok(`${slug} 完成`)
}

console.log(`\n🎉 全部完成！8 张图已落到 R2 showcase/，共消耗 ${totalCredits} KIE credits`)
console.log('   首页 showcase 现在应显示真实示例图。')
```

- [ ] **Step 2: lint（脚本目录通常不在 eslint 范围，确认无碍）**

Run: `npm run lint`
Expected: 无错误（`scripts/` 不被 eslint 扫描，或扫描通过）。

- [ ] **Step 3: Commit**

```bash
git add scripts/gen-showcase.mjs
git commit -m "feat: 加 gen-showcase.mjs 生成首页示例图脚本

8 个经典纹身题材 × 无脸身体照 → KIE 两步（text-to-image + image-to-image）
→ 落 R2 showcase/<slug>.png。消耗 ~48 KIE credits ≈ \$0.24。

身体照源在 BODY_PHOTOS 数组填（R2 showcase/body/* 或 Unsplash 直链）。
内联 KIE 调用（与 verify-day3.mjs 同构），不抽 ts 函数（mjs 不能 import ts）。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 跑脚本生成示例图（需用户参与）

> 本 task 消耗真实 KIE credits（~$0.24）+ 需要 Unsplash 身体照源，由用户执行。Claude 完成 Task 1-6 + 8 代码工作后，把这一节交给用户。

- [ ] **Step 1: 准备无脸身体照**

从 Unsplash 选 1–8 张无脸局部身体照（只拍手臂/腿/肩，不含头；免费商用）。下载后上传到 R2 `showcase/body/`（用 `scripts/verify-day2.mjs` 同样的方式，或 R2 后台手动上传），拿到 public URL；或直接用 Unsplash 直链。

- [ ] **Step 2: 填到 `scripts/gen-showcase.mjs` 的 `BODY_PHOTOS` 数组**

把上一步的 URL 填入 `BODY_PHOTOS`（取消注释 / 替换占位）。

- [ ] **Step 3: 跑脚本**

Run: `node --env-file=.env.local scripts/gen-showcase.mjs`
Expected: 逐个打印 `[i/8] slug: ...`，最终 `🎉 全部完成！8 张图已落到 R2 showcase/`。

- [ ] **Step 4: 验证首页**

`npm run dev` → 未登录首页 showcase 区显示 8 张真实示例图；点击进 Lightbox 浏览。

> 失败处理：单个 slug 失败（如审核拒绝）脚本会 `fail` 退出。可注释掉 `EXAMPLES` 里失败的 slug + `showcase-examples.ts` 对应行，重跑剩余。

---

## Task 8: 全量 build + lint 验证收口

**Files:** 无（仅验证）

- [ ] **Step 1: 全量 lint + build**

Run: `npm run lint && npm run build`
Expected: 全过（仅已知 middleware 弃用警告）。

- [ ] **Step 2: grep 确认无残留旧 Dialog 用法**

Run（在 repo 根）：
```bash
git grep -nE "max-w-3xl" -- src/components/generation-results.tsx src/components/history-image-dialog.tsx
git grep -n "DialogContent" -- src/components/generation-results.tsx src/components/history-image-dialog.tsx
```
Expected: 两个都 `No matches found`（旧卡片 Dialog 已全部换成 Lightbox）。

- [ ] **Step 3: 若 Task 7 已跑完（示例图已生成），最终端到端验证**

- 未登录首页：showcase 8 张真实图 + "See examples" 滚动 + 点击 Lightbox
- 生成结果页：点图进全屏 Lightbox，可切换设计稿+部位
- `/history`：点缩略图进全屏 Lightbox，切换逻辑正常（失败部位跳过）

- [ ] **Step 4: 若 Step 1-2 全过且无需补救，无需额外 commit**；若 build 报错，回对应 Task 修复后 `fix:` commit。

---

## 验证清单（对照 spec §8）

- [x 计划覆盖] `lint + build` 全过 → Task 1/2/3/4/5/8
- [x 计划覆盖] 生成结果点图 → 全屏 Lightbox，切换/关闭都工作 → Task 2
- [x 计划覆盖] 历史点缩略图 → 全屏 Lightbox，失败部位跳过 → Task 3
- [x 计划覆盖] 首页 signed-out 见 showcase、"See examples" 滚动、signed-in 不见 → Task 5
- [x 计划覆盖] showcase 图点击 → Lightbox 串联切换 → Task 4
- [x 计划覆盖] `gen-showcase.mjs` 生成 8 张到 R2（~48 credits）→ Task 6/7

---

## 风险与注意事项

1. **base-ui `Dialog.Popup` 的 `onClick` 透传**：Task 1 Step 1 已注明备选方案（`pointer-events` 穿透）。若点击图片外不关闭，用备选方案。
2. **`Button render` prop**：Task 5 Step 2 用 base-ui render prop 把 Button 渲染成 Link（`ui/dialog.tsx:65` 已验证此模式可用）。
3. **示例图未生成时**：showcase img broken，显示 alt + `bg-muted` 占位，不崩；Task 7 跑完后自然恢复。**先上 Task 1-6（交互可验证），Task 7 示例图后补**。
4. **身体照源是 Task 7 的硬依赖**：用户需准备 Unsplash 无脸身体照。若暂无，showcase 区先空着（占位），不阻塞 Lightbox + 锚点改造上线。
5. **审核风险**：8 个 prompt 均经典题材，不涉版权角色（避开"派大星"类）。若仍被拒，注释对应 slug 重跑。
