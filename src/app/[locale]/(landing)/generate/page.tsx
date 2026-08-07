import { setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { TattooGenerator } from '@/shared/blocks/tattoo/tattoo-generator';
import { getMetadata } from '@/shared/lib/seo';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  title: 'AI Tattoo Generator — Preview Your Tattoo Before You Ink',
  description:
    'Upload your photo, describe your tattoo idea, and AI generates realistic tattoo previews on your body. Try it free — no artist appointment needed.',
  keywords: 'AI tattoo, tattoo preview, tattoo generator, AI tattoo design, body art preview',
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
    sections: {
      hero: {
        title: 'AI Tattoo Generator',
        description:
          'Upload your photo, describe your idea, and see how your tattoo will look before you commit. AI generates 4 realistic previews on different body parts.',
      },
      generator: {
        component: <TattooGenerator />,
      },
    },
  };

  const Page = await getThemePage('dynamic-page');

  return <Page locale={locale} page={page} />;
}
