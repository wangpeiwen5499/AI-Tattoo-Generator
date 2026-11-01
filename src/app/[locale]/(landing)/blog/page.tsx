import { setRequestLocale } from 'next-intl/server';

import { TattooGuideLinks } from '@/shared/blocks/tattoo/tattoo-guide-links';
import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 86400;
type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return getMetadata({
    title:
      locale === 'zh'
        ? '纹身设计与试戴博客 | TattooVis'
        : 'Tattoo Design & Try-on Blog | TattooVis',
    description:
      locale === 'zh'
        ? '阅读极简纹身、几何设计和首次纹身指南，探索提示词、构图与照片试戴。'
        : 'Read practical guides to minimalist designs, geometric tattoos and first tattoo ideas, with prompts and photo try-on tips.',
    canonicalUrl: '/blog',
  })({ params });
}
export default async function BlogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="pt-24 sm:pt-28">
      <header className="container">
        <h1 className="text-4xl font-medium sm:text-5xl">
          {locale === 'zh' ? '博客列表' : 'Blog'}
        </h1>
      </header>
      <TattooGuideLinks locale={locale} showAllLink={false} cardsOnly />
    </main>
  );
}
