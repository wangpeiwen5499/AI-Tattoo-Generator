import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { isProductPreview } from '@/config/preview/product';
import { PreviewHome } from '@/shared/blocks/tattoo/preview-product';
import { TattooGuideLinks } from '@/shared/blocks/tattoo/tattoo-guide-links';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;
export const generateMetadata = getMetadata({ canonicalUrl: '/' });

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');
  if (isProductPreview())
    return (
      <>
        <PreviewHome
          locale={locale}
          reviews={t.raw('page.sections.testimonials')}
        />
      </>
    );

  // get page data
  const page: DynamicPage = structuredClone(t.raw('page'));
  const sections = {
    ...page.sections,
    blog: { id: 'blog', component: <TattooGuideLinks locale={locale} /> },
  };
  page.sections = Object.fromEntries(
    (page.show_sections || Object.keys(sections))
      .filter((key) => key in sections)
      .map((key) => [key, sections[key as keyof typeof sections]])
  );

  // load page component
  const Page = await getThemePage('dynamic-page');

  return (
    <>
      <Page locale={locale} page={page} />
    </>
  );
}
