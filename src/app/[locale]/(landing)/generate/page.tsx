import { setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { GenerationAccess } from '@/shared/blocks/tattoo/generation-access';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  title: 'AI Tattoo Generator — Preview Your Tattoo Before You Ink',
  description:
    'Explore a real tattoo example, then sign up for 3 free credits to generate previews with your own photo.',
  keywords:
    'AI tattoo, tattoo preview, tattoo generator, AI tattoo design, body art preview',
  canonicalUrl: '/generate',
});

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const page: DynamicPage = {
    title: 'AI Tattoo Generator',
    sections: {
      generator: {
        component: <GenerationAccess />,
      },
    },
  };

  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
