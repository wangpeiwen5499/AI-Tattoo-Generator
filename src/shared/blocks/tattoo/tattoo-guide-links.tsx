import { Link } from '@/core/i18n/navigation';
import { getTattooGuides } from '@/config/seo/tattoo-guides';

export function TattooGuideLinks({
  locale,
  showAllLink = true,
  cardsOnly = false,
}: {
  locale: string;
  showAllLink?: boolean;
  cardsOnly?: boolean;
}) {
  const zh = locale === 'zh';
  return (
    <section
      id="blog"
      aria-labelledby={cardsOnly ? undefined : 'tattoo-guides-heading'}
      className="scroll-mt-24 py-20 md:py-28"
    >
      <div className="container">
        {!cardsOnly && (
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5 md:mb-14">
            <div className="max-w-2xl">
              <h2
                id="tattoo-guides-heading"
                className="text-3xl font-normal tracking-tight sm:text-4xl lg:text-5xl"
              >
                {zh
                  ? '从一个想法开始你的纹身设计'
                  : 'Find a starting point for your tattoo design'}
              </h2>
            </div>
            {showAllLink && (
              <Link
                href="/blog"
                className="text-primary text-sm underline underline-offset-4"
              >
                {zh ? '阅读全部文章' : 'Read the blog'}
              </Link>
            )}
          </div>
        )}
        <div className="grid gap-5 md:grid-cols-3">
          {getTattooGuides(locale).map((guide) => (
            <article
              key={guide.slug}
              className="blog-guide-card bg-card relative rounded-2xl border p-6"
            >
              <h3 className="mb-3 text-xl font-medium">
                <Link
                  href={`/tattoo-ideas/${guide.slug}`}
                  className="hover:text-primary focus-visible:outline-primary underline-offset-4 after:absolute after:inset-0 after:rounded-2xl hover:underline focus-visible:outline-2"
                >
                  {guide.title}
                </Link>
              </h3>
              <p className="text-muted-foreground text-base leading-7">
                {guide.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
