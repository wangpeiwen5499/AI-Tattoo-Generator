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
