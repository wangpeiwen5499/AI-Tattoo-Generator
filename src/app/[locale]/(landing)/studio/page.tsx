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
        ? 'AI 纹身设计与照片试戴 | TattooVis'
        : 'AI Tattoo Design & Photo Try-on | TattooVis',
    description:
      locale === 'zh'
        ? '上传身体部位照片，上传、生成或复用图案，免费摆放后生成单张真实纹身试戴。'
        : 'Upload a body photo, create or reuse a tattoo design, place it freely, then generate a realistic AI try-on.',
    canonicalUrl: '/studio',
  })({ params });
}
export default async function StudioPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = await searchParams;
  return (
    <main className="container pt-24 sm:pt-28">
      <header className="max-w-3xl">
        <p className="text-primary mb-3 text-sm">
          {locale === 'zh'
            ? '设计 · 摆放 · 真实试戴'
            : 'DESIGN · PLACE · TRY ON'}
        </p>
        <h1 className="text-4xl font-medium sm:text-5xl">
          {locale === 'zh'
            ? '先看见，再决定。'
            : 'See it on your skin, before the ink.'}
        </h1>
        <p className="text-muted-foreground mt-5 text-lg leading-8">
          {locale === 'zh'
            ? '上传一张局部或侧面照片，选择或创作图案，自由摆放后生成真实试戴。手动摆放免费，设计与 AI 试戴分别计费。'
            : 'Start with a close-up or side-view photo. Choose or create a design, place it freely, then generate a realistic try-on. Placement is free; designs and AI try-ons are charged separately.'}
        </p>
      </header>
      <ManualEditor
        key={`${query.design || ''}:${query.history || ''}`}
        locale={locale}
        initialDesignId={query.design}
        initialHistoryId={query.history}
      />
    </main>
  );
}
