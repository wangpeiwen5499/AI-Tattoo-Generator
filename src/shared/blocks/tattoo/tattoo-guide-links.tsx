import { Link } from '@/core/i18n/navigation';
import { getTattooGuides } from '@/config/seo/tattoo-guides';

export function TattooGuideLinks({
  locale,
  showAllLink = true,
}: {
  locale: string;
  /** Hide on the blog index, where the link would point at the current page. */
  showAllLink?: boolean;
}) {
  const zh = locale === 'zh';
  return (
    <section
      id="blog"
      className="tattoo-section scroll-mt-24"
      aria-labelledby="tattoo-guides-heading"
    >
      <div className="tattoo-container">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="tattoo-eyebrow">FROM THE BLOG</p>
            <h2
              id="tattoo-guides-heading"
              className="tattoo-heading"
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
        <div className="grid gap-5 md:grid-cols-3">
          {getTattooGuides(locale).map((guide) => (
            <article key={guide.slug} className="bg-card rounded-2xl border p-6">
              <h3 className="mb-3 text-lg font-medium">
                <Link
                  href={`/tattoo-ideas/${guide.slug}`}
                  className="hover:text-primary underline-offset-4 hover:underline"
                >
                  {guide.title}
                </Link>
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {guide.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
