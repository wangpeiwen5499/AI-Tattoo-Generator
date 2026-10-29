'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Expand, MousePointer2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

import {
  CASE_ASSET_ROOT,
  CASE_PLACEMENTS,
  CASE_PROMPT,
  type CasePlacement,
} from './case-study-data';
import { Lightbox, type LightboxImage } from './lightbox';
import { TrialCta } from './trial-cta';

export function TattooCaseDemo() {
  const t = useTranslations('pages.index.page.sections.hero.demo');
  const id = useId();
  const [stage, setStage] = useState<'photo' | 'prompt' | 'design'>('photo');
  const [placement, setPlacement] = useState<CasePlacement>('left-arm');
  const [showOriginal, setShowOriginal] = useState(true);
  const [enlargedImage, setEnlargedImage] = useState<LightboxImage | null>(
    null
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const previewOpenerRef = useRef<HTMLButtonElement | null>(null);
  const generated = stage === 'design';
  const active = showOriginal ? 'before' : placement;
  const currentPart = CASE_PLACEMENTS.find((part) => part.id === placement)!;
  const caption = showOriginal ? t('original') : t(currentPart.label);
  const photoAlt = showOriginal
    ? t('originalAlt')
    : `${t('previewAlt')}: ${t(currentPart.label)}`;
  const photos = ['before', ...CASE_PLACEMENTS.map((part) => part.id)];

  function openImage(image: LightboxImage, opener: HTMLButtonElement) {
    previewOpenerRef.current = opener;
    setEnlargedImage(image);
  }

  function revealDesign() {
    setStage('design');
    setShowOriginal(false);
    if (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 1023px)').matches
    ) {
      previewRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
    }
  }

  function restart() {
    setStage('photo');
    setPlacement('left-arm');
    setShowOriginal(true);
    setEnlargedImage(null);
  }

  return (
    <section
      id="tattoo-case"
      aria-labelledby={`${id}-title`}
      className="text-foreground mx-auto max-w-6xl scroll-mt-24"
    >
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4 py-5 sm:mb-10">
        <div>
          <p className="text-muted-foreground mb-3 flex items-center gap-2 text-sm">
            <MousePointer2 className="size-4" aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h2
            id={`${id}-title`}
            className="text-2xl font-normal tracking-tight sm:text-3xl"
          >
            {t('title')}
          </h2>
        </div>
        <button
          type="button"
          onClick={restart}
          className="text-muted-foreground hover:text-foreground focus-visible:outline-primary flex items-center gap-2 rounded-md px-2 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {t('restart')}
        </button>
      </header>

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="flex min-w-0 flex-col gap-10">
          <div>
            <StepHeading
              number="1"
              title={t('uploadTitle')}
              complete={stage !== 'photo'}
            />
            <div className="mt-5 flex items-center gap-5 sm:pl-10">
              <button
                type="button"
                aria-label={t('enlargeOriginal')}
                onClick={(event) =>
                  openImage(
                    {
                      url: `${CASE_ASSET_ROOT}/before.webp`,
                      alt: t('originalAlt'),
                    },
                    event.currentTarget
                  )
                }
                className="group focus-visible:outline-primary relative shrink-0 overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <Image
                  src={`${CASE_ASSET_ROOT}/before.webp`}
                  alt=""
                  width={96}
                  height={128}
                  className="w-24 object-contain sm:w-28"
                  unoptimized
                />
                <span className="absolute right-2 bottom-2 rounded-full bg-black/60 p-1.5 text-white">
                  <Expand className="size-3.5" aria-hidden="true" />
                </span>
              </button>
              <div className="min-w-0">
                <p className="text-base font-medium">{t('samplePhoto')}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {t('sampleDescription')}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStage('prompt');
                    setShowOriginal(true);
                  }}
                  aria-pressed={stage !== 'photo'}
                  className="mt-4"
                >
                  {stage !== 'photo' && (
                    <Check className="size-4" aria-hidden="true" />
                  )}
                  {stage === 'photo' ? t('usePhoto') : t('photoSelected')}
                </Button>
              </div>
            </div>
          </div>

          <div>
            <StepHeading
              number="2"
              title={t('promptTitle')}
              complete={generated}
            />
            <div className="mt-5 sm:pl-10">
              <label htmlFor={`${id}-prompt`} className="sr-only">
                {t('promptLabel')}
              </label>
              <textarea
                id={`${id}-prompt`}
                readOnly
                value={CASE_PROMPT}
                rows={12}
                className="bg-muted/40 text-foreground focus-visible:outline-primary [field-sizing:content] min-h-64 w-full resize-none rounded-xl border-0 px-4 py-4 text-base leading-7 focus-visible:outline-2 focus-visible:outline-offset-2"
              />
              <Button
                type="button"
                onClick={revealDesign}
                className="mt-4 h-11 w-full text-sm"
              >
                {generated ? (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    {t('designReady')}
                  </>
                ) : (
                  t('revealDesign')
                )}
              </Button>
            </div>
          </div>

          <div>
            <StepHeading
              number="3"
              title={t('designTitle')}
              complete={generated}
            />
            <div className="mt-5 flex flex-wrap items-center gap-5 sm:pl-10">
              <button
                type="button"
                aria-label={t('enlargeDesign')}
                onClick={(event) =>
                  openImage(
                    {
                      url: `${CASE_ASSET_ROOT}/design.webp`,
                      alt: t('designAlt'),
                    },
                    event.currentTarget
                  )
                }
                className="group focus-visible:outline-primary relative shrink-0 overflow-hidden rounded-xl bg-white focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <Image
                  src={`${CASE_ASSET_ROOT}/design.webp`}
                  alt={t('designAlt')}
                  width={176}
                  height={176}
                  className="w-40 object-contain p-2 sm:w-44"
                  unoptimized
                />
                <span className="absolute right-2 bottom-2 rounded-full bg-black/60 p-1.5 text-white">
                  <Expand className="size-3.5" aria-hidden="true" />
                </span>
              </button>
              <div className="min-w-32 flex-1">
                <p className="text-base font-medium">{t('designName')}</p>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {t('designDescription')}
                </p>
                <p className="text-primary mt-4 text-sm font-medium">
                  {t('chooseHint')}
                </p>
              </div>
            </div>
          </div>

          <div className="sm:pl-10">
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('exampleNote')}
            </p>
            <TrialCta className="text-primary focus-visible:outline-primary mt-4 inline-flex rounded-sm text-base font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4" />
          </div>
        </div>

        <div ref={previewRef} className="min-w-0 scroll-mt-24">
          <div className="bg-background/95 sticky top-20 z-10 pt-2 pb-3 backdrop-blur-sm lg:top-24">
            <p id={`${id}-placements`} className="mb-4 text-lg font-medium">
              {t('placementTitle')}
            </p>
            <div
              role="group"
              aria-labelledby={`${id}-placements`}
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {CASE_PLACEMENTS.map((part) => (
                <button
                  key={part.id}
                  type="button"
                  aria-pressed={!showOriginal && placement === part.id}
                  aria-controls={`${id}-preview`}
                  onClick={() => {
                    setStage('design');
                    setPlacement(part.id);
                    setShowOriginal(false);
                  }}
                  className={cn(
                    'focus-visible:outline-primary scroll-mt-40 rounded-full px-3 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none sm:whitespace-nowrap',
                    !showOriginal && placement === part.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-primary/10'
                  )}
                >
                  {t(part.label)}
                </button>
              ))}
            </div>
          </div>
          <figure id={`${id}-preview`} className="mx-auto mt-5 max-w-[480px]">
            <figcaption className="mb-3 flex min-h-10 items-center justify-between gap-3">
              <span
                aria-live="polite"
                aria-atomic="true"
                className="text-sm font-medium"
              >
                {caption}
              </span>
              <button
                type="button"

                onClick={() => {
                  setStage('design');
                  setShowOriginal((value) => !value);
                }}
                className="text-muted-foreground hover:text-foreground focus-visible:outline-primary rounded-sm text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                {showOriginal ? t('showTattoo') : t('showOriginal')}
              </button>
            </figcaption>
            <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-2xl bg-[#a4a29f]">
              {photos.map((photo) => (
                <Image
                  key={photo}
                  src={`${CASE_ASSET_ROOT}/${photo}.webp`}
                  alt={photo === active ? photoAlt : ''}
                  aria-hidden={photo !== active}
                  data-testid={
                    photo === active ? 'tattoo-case-photo' : undefined
                  }
                  fill
                  sizes="(max-width:1023px) 95vw,480px"
                  priority={photo === 'before'}
                  loading={photo === 'before' ? undefined : 'eager'}
                  unoptimized
                  className={cn(
                    'object-contain transition-opacity duration-200 motion-reduce:transition-none',
                    photo === active
                      ? 'opacity-100'
                      : 'pointer-events-none opacity-0'
                  )}
                />
              ))}
              <button
                type="button"
                onClick={(event) =>
                  openImage(
                    { url: `${CASE_ASSET_ROOT}/${active}.webp`, alt: photoAlt },
                    event.currentTarget
                  )
                }
                aria-label={t('enlarge')}
                className="focus-visible:outline-primary absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <span className="absolute right-3 bottom-3 rounded-full bg-black/60 p-3 text-white">
                  <Expand className="size-4" aria-hidden="true" />
                </span>
              </button>
            </div>
          </figure>
          <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed">
            {t('anatomyNote')}
          </p>
        </div>
      </div>

      <Lightbox
        images={enlargedImage ? [enlargedImage] : []}
        index={enlargedImage ? 0 : null}
        onClose={() => setEnlargedImage(null)}
        onIndexChange={() => {}}
        labels={{
          close: t('closePreview'),
          description: t('previewInstructions'),
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          previewOpenerRef.current?.focus();
        }}
      />
    </section>
  );
}

function StepHeading({
  number,
  title,
  complete,
}: {
  number: string;
  title: string;
  complete: boolean;
}) {
  return (
    <h3 className="flex items-center gap-3 text-lg font-medium">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full text-xs',
          complete
            ? 'bg-primary/10 text-primary'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {complete ? <Check className="size-3.5" /> : number}
      </span>
      {title}
    </h3>
  );
}
