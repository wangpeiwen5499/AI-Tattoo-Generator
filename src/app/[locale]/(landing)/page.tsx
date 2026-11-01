import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { TattooGuideLinks } from '@/shared/blocks/tattoo/tattoo-guide-links';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');

  // get page data
  const page: DynamicPage = structuredClone(t.raw('page'));
  // Keep all live sections intact; insert the independent Blog module before reviews.
  page.sections = Object.fromEntries(
    Object.entries(page.sections || {}).flatMap(([key, section]) =>
      key === 'testimonials'
        ? [
            [
              'blog',
              { id: 'blog', component: <TattooGuideLinks locale={locale} /> },
            ],
            [key, section],
          ]
        : [[key, section]]
    )
  );
  if (page.show_sections) {
    page.show_sections = page.show_sections.flatMap((key) =>
      key === 'testimonials' ? ['blog', key] : [key]
    );
  }

  // load page component
  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
