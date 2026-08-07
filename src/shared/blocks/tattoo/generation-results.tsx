'use client'

import { useState } from 'react'
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Lightbox, type LightboxImage } from '@/shared/blocks/tattoo/lightbox'
import { BODY_PART_LABELS, type BodyPart } from '@/lib/constants'

type GenerateImage = { bodyPart: string; status: string; url: string | null }

type Props = {
  tattooDesignUrl: string | null
  images: GenerateImage[]
  refunded?: boolean
  onRegenerate: () => void
  onReset: () => void
}

export function GenerationResults({ tattooDesignUrl, images, refunded, onRegenerate, onReset }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)

  const successCount = images.filter((i) => i.status === 'completed').length

  const lightboxImages: LightboxImage[] = []
  const designLightboxIndex = tattooDesignUrl ? 0 : -1
  if (tattooDesignUrl) {
    lightboxImages.push({ url: tattooDesignUrl, alt: 'Generated tattoo design' })
  }

  const partLightboxIndex: number[] = images.map((img) => {
    if (img.status === 'completed' && img.url) {
      const idx = lightboxImages.length
      lightboxImages.push({ url: img.url, alt: `Tattoo on ${BODY_PART_LABELS[img.bodyPart as BodyPart] ?? img.bodyPart}` })
      return idx
    }
    return -1
  })

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

      {tattooDesignUrl && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Your Tattoo Design</h3>
          </div>
          <button
            type="button"
            onClick={() => setLightboxIndex(designLightboxIndex)}
            className="group block w-full overflow-hidden rounded-lg border border-border/50 bg-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={tattooDesignUrl} alt="Generated tattoo design" className="aspect-square w-full object-contain transition-transform group-hover:scale-[1.01]" />
          </button>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Placed on 4 body parts</h3>
          <span className="text-xs text-muted-foreground">{successCount}/{images.length} succeeded · click to zoom</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, i) => (
            <ResultCell
              key={img.bodyPart}
              image={img}
              onZoom={() => {
                const idx = partLightboxIndex[i]
                if (idx >= 0) setLightboxIndex(idx)
              }}
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

      <Lightbox images={lightboxImages} index={lightboxIndex} onClose={() => setLightboxIndex(null)} onIndexChange={setLightboxIndex} />
    </div>
  )
}

function ResultCell({ image, onZoom }: { image: GenerateImage; onZoom: () => void }) {
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
      onClick={onZoom}
      className="group relative block aspect-[3/4] w-full overflow-hidden rounded-lg border border-border/50 bg-muted"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.url} alt={`Tattoo on ${label}`} className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]" />
      <span className="absolute bottom-2 left-2 rounded bg-background/80 px-2 py-0.5 text-xs font-medium backdrop-blur">{label}</span>
    </button>
  )
}
