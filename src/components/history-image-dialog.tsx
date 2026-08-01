'use client'

import { useState } from 'react'
import { Lightbox, type LightboxImage } from '@/components/lightbox'

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

// 复用 Lightbox 的图片类型（alt 取代 title）
type DialogImage = LightboxImage

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
  // 同时记录每个 bodyPart 在 images 数组里的索引，避免后续用 url 反查（防 url 重复时定位错位）
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

  const designIndex = tattooDesignUrl ? 0 : -1

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
          {bodyParts.map((bp, i) => (
            <BodyPartCell
              key={bp.label}
              bodyPart={bp}
              onClick={() => {
                const idx = bodyPartDialogIndex[i]
                if (idx >= 0) setOpenIndex(idx)
              }}
            />
          ))}
        </div>
      </div>

      <Lightbox
        images={images}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onIndexChange={setOpenIndex}
      />
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
