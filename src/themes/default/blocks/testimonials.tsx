'use client';

import { useState } from 'react';
import { Pause, Play, Quote } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { cn } from '@/shared/lib/utils';
import { Section, SectionItem } from '@/shared/types/blocks/landing';

function ReviewCard({ item }: { item: SectionItem }) {
  return (
    <figure className="tattoo-review-card">
      <Quote
        size={30}
        strokeWidth={1}
        className="text-primary/65 mb-6"
        aria-hidden="true"
      />
      <blockquote className="text-lg leading-8 tracking-[-0.01em]">
        {item.quote || item.description}
      </blockquote>
      <figcaption className="mt-8 flex items-center gap-3 border-t pt-5">
        <span
          className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-full text-base font-medium"
          aria-hidden="true"
        >
          {Array.from(String(item.name || '').trim())[0]?.toLocaleUpperCase() ||
            '?'}
        </span>
        <div>
          <p className="text-sm font-semibold">{item.name}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {item.role || item.title}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}
export function Testimonials({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  const [paused, setPaused] = useState(false);
  const t = useTranslations('common.reviews');
  if (!section.items?.length) return null;
  return (
    <section
      id={section.id}
      className={cn(
        'tattoo-reviews tattoo-section',
        section.className,
        className
      )}
      data-paused={paused}
      aria-labelledby={section.id ? section.id + '-title' : undefined}
    >
      <div className="tattoo-container mb-10 flex flex-wrap items-end justify-between gap-6 md:mb-14">
        <div className="max-w-2xl">
          <h2
            id={section.id ? section.id + '-title' : undefined}
            className="text-3xl font-normal tracking-tight sm:text-4xl lg:text-5xl"
          >
            {section.title}
          </h2>
          <p className="text-muted-foreground mt-5 text-base leading-relaxed">
            {section.description}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
          className="tattoo-review-control border-border bg-card hover:bg-muted focus-visible:outline-primary inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {paused ? (
            <Play size={15} aria-hidden="true" />
          ) : (
            <Pause size={15} aria-hidden="true" />
          )}
          {paused ? t('play') : t('pause')}
        </button>
      </div>
      <div className="tattoo-reviews-window tattoo-container overflow-hidden">
        <div className="tattoo-reviews-track">
          {[0, 1].map((copy) => (
            <div
              key={copy}
              className="tattoo-reviews-group"
              aria-hidden={copy === 1 ? true : undefined}
            >
              {section.items?.map((item, index) => (
                <ReviewCard item={item} key={index} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
