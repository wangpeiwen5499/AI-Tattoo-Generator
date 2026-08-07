import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { TattooGenerator } from '@/shared/blocks/tattoo/tattoo-generator';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  title: 'AI Tattoo Generator - Preview Your Tattoo Before You Ink',
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

  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <TattooGenerator />
    </div>
  );
}
