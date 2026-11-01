import { setRequestLocale } from 'next-intl/server';

import { ManualEditor } from '@/shared/blocks/tattoo/manual-editor';
import { getMetadata } from '@/shared/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ design?: string; history?: string }>;
};
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return getMetadata({
    title:
      locale === 'zh'
        ? '纹身模拟器：在自己的照片上试戴设计 | TattooVis'
        : 'Tattoo Simulator: Try a Design on Your Photo | TattooVis',
    description:
      locale === 'zh'
        ? '上传、生成或复用纹身图案，在照片上免费调整位置，再生成单张 AI 试戴。新设计 1 积分，1K/2K/4K 试戴分别为 1/2/3 积分。'
        : 'Use the tattoo simulator to place a design on your photo for free, then generate one AI try-on. Designs cost 1 credit; 1K/2K/4K try-ons cost 1/2/3 credits.',
    canonicalUrl: '/studio',
  })({ params });
}
export default async function StudioPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  return (
    <main className="studio-main container pt-20">
      {!query.history && (
        <header className="max-w-3xl">
          <h1 className="text-2xl font-medium sm:text-3xl">
            {locale === 'zh' ? '纹身模拟器' : 'Tattoo simulator'}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {locale === 'zh'
              ? '在自己的照片上选择位置、摆放图案，再生成真实试戴。'
              : 'Place a design on your own photo, then create a realistic AI try-on.'}
          </p>
        </header>
      )}
      <ManualEditor
        key={`${query.design || ''}:${query.history || ''}`}
        locale={locale}
        initialDesignId={query.design}
        initialHistoryId={query.history}
      />
    </main>
  );
}
