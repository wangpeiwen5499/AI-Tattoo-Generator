'use client';

import { useState } from 'react';
import { BODY_PART_LABELS, type BodyPart } from '@/lib/constants';
import { AlertTriangle, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Lightbox, type LightboxImage } from '@/shared/blocks/tattoo/lightbox';
import { Button } from '@/shared/components/ui/button';

type GenerateImage = { bodyPart: string; status: string; url: string | null };

type Props = {
  tattooDesignUrl: string | null;
  images: GenerateImage[];
  refunded?: boolean;
  onRegenerate: () => void;
  onReset: () => void;
  regenerateLabel?: string;
};

export function GenerationResults({
  tattooDesignUrl,
  images,
  refunded,
  onRegenerate,
  onReset,
  regenerateLabel,
}: Props) {
  const t = useTranslations('common.funnel');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const successCount = images.filter((i) => i.status === 'completed').length;

  const lightboxImages: LightboxImage[] = [];
  const designLightboxIndex = tattooDesignUrl ? 0 : -1;
  if (tattooDesignUrl) {
    lightboxImages.push({
      url: tattooDesignUrl,
      alt: 'Generated tattoo design',
    });
  }

  const partLightboxIndex: number[] = images.map((img) => {
    if (img.status === 'completed' && img.url) {
      const idx = lightboxImages.length;
      lightboxImages.push({
        url: img.url,
        alt: `Tattoo on ${BODY_PART_LABELS[img.bodyPart as BodyPart] ?? img.bodyPart}`,
      });
      return idx;
    }
    return -1;
  });

  return (
    <div className="flex flex-col gap-6">
      {(refunded || successCount < images.length) && (
        <div className="border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div>
            <p className="font-medium">Some previews could not be generated</p>
            <p className="text-xs">
              {refunded ? 'Your credit has been returned. ' : ''}Available
              previews are shown below.
            </p>
          </div>
        </div>
      )}

      {tattooDesignUrl && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="text-primary h-5 w-5" />
            <h3 className="text-base font-semibold">Your Tattoo Design</h3>
          </div>
          <button
            type="button"
            onClick={() => setLightboxIndex(designLightboxIndex)}
            className="group border-border/50 bg-muted block w-full overflow-hidden rounded-lg border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tattooDesignUrl}
              alt="Generated tattoo design"
              className="aspect-square w-full object-contain transition-transform group-hover:scale-[1.01]"
            />
          </button>
          <a
            href={`/api/proxy/file?url=${encodeURIComponent(tattooDesignUrl)}`}
            download="tattoo-design"
            className="mt-2 inline-block text-sm underline underline-offset-4"
          >
            {t('saveDesign')}
          </a>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-semibold">Placed on 4 body parts</h3>
          <span className="text-muted-foreground text-xs">
            {successCount}/{images.length} succeeded · click to zoom
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, i) => (
            <ResultCell
              key={img.bodyPart}
              image={img}
              saveLabel={t('savePreview')}
              onZoom={() => {
                const idx = partLightboxIndex[i];
                if (idx >= 0) setLightboxIndex(idx);
              }}
            />
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onRegenerate} variant="default" className="sm:flex-1">
          <RotateCcw className="mr-2 h-4 w-4" />
          {regenerateLabel || 'Try another idea'}
        </Button>
        <Button onClick={onReset} variant="outline" className="sm:flex-1">
          Start over
        </Button>
      </div>

      <Lightbox
        images={lightboxImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function ResultCell({
  image,
  onZoom,
  saveLabel,
}: {
  saveLabel: string;
  image: GenerateImage;
  onZoom: () => void;
}) {
  const label = BODY_PART_LABELS[image.bodyPart as BodyPart] ?? image.bodyPart;

  if (image.status !== 'completed' || !image.url) {
    return (
      <div className="border-border/50 bg-muted flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-lg border p-4 text-center">
        <AlertTriangle className="text-muted-foreground h-5 w-5" />
        <p className="text-xs font-medium">{label}</p>
        <p className="text-muted-foreground text-xs">This part failed</p>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={onZoom}
        className="group border-border/50 bg-muted relative block aspect-[3/4] w-full overflow-hidden rounded-lg border"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={`Tattoo on ${label}`}
          className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        />
        <span className="bg-background/80 absolute bottom-2 left-2 rounded px-2 py-0.5 text-xs font-medium backdrop-blur">
          {label}
        </span>
      </button>
      <a
        href={`/api/proxy/file?url=${encodeURIComponent(image.url)}`}
        download={`tattoo-${image.bodyPart}`}
        className="mt-2 inline-block text-xs underline underline-offset-4"
      >
        {saveLabel} · {label}
      </a>
    </div>
  );
}
