'use client';

import Image from 'next/image';

import { SmartIcon } from '@/shared/blocks/common/smart-icon';
import { cn } from '@/shared/lib/utils';
import { Section } from '@/shared/types/blocks/landing';

export function Features({
  section,
  className,
}: {
  section: Section;
  className?: string;
}) {
  return (
    <section
      id={section.id}
      className={cn('py-20 md:py-28', section.className, className)}
    >
      <div className="container">
        <div className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <h2 className="text-3xl font-normal tracking-tight sm:text-4xl lg:text-5xl">
            {section.title}
          </h2>
          <p className="text-muted-foreground mt-5 text-base leading-relaxed">
            {section.description}
          </p>
        </div>
        <div className="tattoo-features-grid">
          {section.items?.map((item, index) => (
            <article
              key={item.title || index}
              className={cn(
                'tattoo-feature',
                index === 0 && 'tattoo-feature-showcase',
                index === 1 && 'tattoo-feature-ink',
                index === 5 && 'tattoo-feature-note'
              )}
            >
              <div className="tattoo-feature-copy">
                <div className="tattoo-feature-icon">
                  <SmartIcon name={item.icon as string} size={25} />
                </div>
                <h3 className="mt-7 text-2xl leading-tight font-normal sm:text-[1.75rem]">
                  {item.title}
                </h3>
                <p className="mt-4 max-w-md text-sm leading-7 opacity-75">
                  {item.description}
                </p>
              </div>
              {index === 0 && (
                <div className="tattoo-feature-art" aria-hidden="true">
                  <Image
                    src="/imgs/cases/geometric-wolf/design.webp"
                    alt=""
                    fill
                    sizes="(max-width:640px) 180px,260px"
                    className="object-contain p-2"
                  />
                </div>
              )}
              {index === 1 && (
                <div className="tattoo-ink-lines" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
