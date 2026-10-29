'use client';

import { useId, useRef, useState } from 'react';
import Image from 'next/image';
import { Check, Expand, MousePointer2, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';

import {
  CASE_ASSET_ROOT,
  CASE_PLACEMENTS,
  CASE_PROMPT,
  type CasePlacement,
} from './case-study-data';
import { Lightbox } from './lightbox';

export function TattooCaseDemo() {
  const t = useTranslations('pages.index.page.sections.hero.demo');
  const id = useId();
  const [stage, setStage] = useState<'photo' | 'prompt' | 'design'>('photo');
  const [placement, setPlacement] = useState<CasePlacement>('left-arm');
  const [showOriginal, setShowOriginal] = useState(true);
  const [enlarged, setEnlarged] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const enlargeButtonRef = useRef<HTMLButtonElement>(null);
  const generated = stage === 'design';
  const active = showOriginal ? 'before' : placement;
  const currentPart = CASE_PLACEMENTS.find((part) => part.id === placement)!;
  const caption = showOriginal ? t('original') : t(currentPart.label);
  const photoAlt = showOriginal
    ? t('originalAlt')
    : `${t('previewAlt')}: ${t(currentPart.label)}`;
  const photos = generated
    ? ['before', ...CASE_PLACEMENTS.map((part) => part.id)]
    : ['before'];

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
    setEnlarged(false);
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="bg-card text-card-foreground mx-auto max-w-6xl overflow-hidden rounded-2xl border shadow-lg shadow-black/5"
    >
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-5 sm:px-8">
        <div>
          <p className="text-muted-foreground mb-1 flex items-center gap-2 text-xs">
            <MousePointer2 className="size-3.5" aria-hidden="true" />
            {t('eyebrow')}
          </p>
          <h2
            id={`${id}-title`}
            className="text-lg font-semibold tracking-tight sm:text-xl"
          >
            {t('title')}
          </h2>
        </div>
        <button
          type="button"
          onClick={restart}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          {t('restart')}
        </button>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-6 p-5 sm:p-8 lg:border-r">
          <div>
            <StepHeading
              number="1"
              title={t('uploadTitle')}
              complete={stage !== 'photo'}
            />
            <div className="mt-3 flex items-center gap-4 pl-10">
              <Image
                src={`${CASE_ASSET_ROOT}/before.webp`}
                alt=""
                width={66}
                height={88}
                className="rounded-md border object-contain"
                unoptimized
              />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t('samplePhoto')}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                  {t('sampleDescription')}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setStage('prompt')}
                  disabled={stage !== 'photo'}
                  className="mt-3 h-8 text-xs"
                >
                  {stage !== 'photo' && (
                    <Check className="size-3.5" aria-hidden="true" />
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
            <div className="mt-3 pl-10">
              <label htmlFor={`${id}-prompt`} className="sr-only">
                {t('promptLabel')}
              </label>
              <textarea
                id={`${id}-prompt`}
                readOnly
                value={CASE_PROMPT}
                rows={5}
                className="bg-background/60 text-muted-foreground w-full resize-none rounded-lg border px-3 py-3 text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
              />
              <Button
                type="button"
                onClick={revealDesign}
                disabled={stage !== 'prompt'}
                className="mt-3 w-full text-sm"
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
            <div className="mt-3 pl-10">
              {generated ? (
                <div className="flex items-center gap-4">
                  <Image
                    src={`${CASE_ASSET_ROOT}/design.webp`}
                    alt={t('designAlt')}
                    width={120}
                    height={120}
                    className="shrink-0 rounded-lg border bg-white object-contain p-1.5"
                    unoptimized
                  />
                  <div>
                    <p className="text-sm font-medium">{t('designName')}</p>
                    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
                      {t('designDescription')}
                    </p>
                    <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                      {t('chooseHint')}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-xs leading-relaxed">
                  {t('designPlaceholder')}
                </p>
              )}
            </div>
          </div>

          <div className="mt-auto border-t pt-5">
            <p className="text-muted-foreground text-xs leading-relaxed">
              {t('exampleNote')}
            </p>
            <Link
              href="/generate"
              className="text-primary mt-3 inline-flex rounded-sm text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500"
            >
              {t('createOwn')}
            </Link>
          </div>
        </div>

        <div
          ref={previewRef}
          className="bg-muted/35 min-w-0 scroll-mt-24 border-t lg:border-t-0"
        >
          <div className="px-4 pt-5 sm:px-6">
            <p id={`${id}-placements`} className="mb-3 text-sm font-medium">
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
                  disabled={!generated}
                  aria-pressed={
                    generated && !showOriginal && placement === part.id
                  }
                  aria-controls={`${id}-preview`}
                  onClick={() => {
                    setPlacement(part.id);
                    setShowOriginal(false);
                  }}
                  className={cn(
                    'rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none sm:whitespace-nowrap',
                    generated && !showOriginal && placement === part.id
                      ? 'border-amber-500/70 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                      : 'bg-background/60 hover:enabled:border-amber-500/60'
                  )}
                >
                  {t(part.label)}
                </button>
              ))}
            </div>
          </div>

          <figure
            id={`${id}-preview`}
            className="mx-auto my-4 w-[calc(100%_-_2rem)] max-w-[420px] overflow-hidden rounded-xl border sm:my-6 sm:w-[calc(100%_-_3rem)]"
          >
            <figcaption className="bg-background flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2">
              <span
                aria-live="polite"
                aria-atomic="true"
                className="text-sm font-medium"
              >
                {caption}
              </span>
              <button
                type="button"
                disabled={!generated}
                aria-pressed={generated && showOriginal}
                onClick={() => setShowOriginal((value) => !value)}
                className="text-muted-foreground hover:text-foreground rounded-sm text-xs underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500 disabled:invisible"
              >
                {showOriginal ? t('showTattoo') : t('showOriginal')}
              </button>
            </figcaption>
            <div className="relative mx-auto aspect-[3/4] w-full bg-[#a4a29f]">
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
                  sizes="(max-width: 1023px) 90vw, 540px"
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
                ref={enlargeButtonRef}
                type="button"
                onClick={() => setEnlarged(true)}
                aria-label={t('enlarge')}
                className="absolute right-3 bottom-3 rounded-full bg-black/60 p-2.5 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <Expand className="size-4" aria-hidden="true" />
              </button>
            </div>
          </figure>
          <p className="text-muted-foreground px-5 pb-5 text-center text-[11px] leading-relaxed">
            {generated ? t('anatomyNote') : t('startHint')}
          </p>
        </div>
      </div>

      <Lightbox
        images={[{ url: `${CASE_ASSET_ROOT}/${active}.webp`, alt: photoAlt }]}
        index={enlarged ? 0 : null}
        onClose={() => setEnlarged(false)}
        onIndexChange={() => {}}
        labels={{
          close: t('closePreview'),
          description: t('previewInstructions'),
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          enlargeButtonRef.current?.focus();
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
    <h3 className="flex items-center gap-3 text-sm font-semibold">
      <span
        aria-hidden="true"
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-full border text-xs',
          complete
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : 'text-muted-foreground'
        )}
      >
        {complete ? <Check className="size-3.5" /> : number}
      </span>
      {title}
    </h3>
  );
}
