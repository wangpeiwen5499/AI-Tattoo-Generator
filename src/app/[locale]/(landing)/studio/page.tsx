import { redirect } from 'next/navigation';
import Script from 'next/script';
import { setRequestLocale } from 'next-intl/server';

import { STUDIO_BODY_HTML } from '@/shared/blocks/tattoo/studio-markup';
import { getMetadata } from '@/shared/lib/seo';

export const dynamic = 'force-dynamic';

export const generateMetadata = getMetadata({
  title: 'Placement Studio — TattooVis',
  description:
    'Upload or create a tattoo design, place it freely on your photo, then generate one AI try-on.',
  canonicalUrl: '/studio',
  noIndex: true,
});

/**
 * The studio editor renders inside the shared site layout (Header, Footer,
 * theme). Its markup is the single exported STUDIO_BODY_HTML template that
 * the editor modules and regression tests also consume.
 */
export default async function StudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);

  // Old deep links (?panel=designs|history) go to the standalone pages.
  const panel = typeof query.panel === 'string' ? query.panel : '';
  if (panel === 'designs' || panel === 'history')
    redirect(locale === 'zh' ? `/zh/${panel}` : `/${panel}`);

  return (
    <>
      <link rel="stylesheet" href="/try-on-lab/studio.css" />
      <div
        id="studio-root"
        data-locale={locale === 'zh' ? 'zh' : 'en'}
        dangerouslySetInnerHTML={{ __html: STUDIO_BODY_HTML }}
      />
      <Script id="studio-editor" src="/try-on-lab/studio.mjs" type="module" />
    </>
  );
}
