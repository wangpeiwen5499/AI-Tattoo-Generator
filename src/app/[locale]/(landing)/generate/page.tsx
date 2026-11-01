import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
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

  return (
    <>
      <div className="container pt-24 text-center">
        <Link
          href="/studio"
          className="text-primary border-primary/30 hover:bg-primary/5 inline-block rounded-xl border px-6 py-3 text-base"
        >
          {locale === 'zh'
            ? '已有纹身图案？免费在照片上手动试戴 →'
            : 'Already have a design? Try it on your photo for free →'}
        </Link>
      </div>
      <Page locale={locale} page={page} />
    </>
  );
}
