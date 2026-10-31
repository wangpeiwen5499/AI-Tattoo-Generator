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
    <main className="pt-8 sm:pt-10">
      <header className="mx-auto max-w-6xl px-5">
        <p className="text-primary mb-3 text-xs tracking-widest">
          TATTOOVIS / JOURNAL
        </p>
        <h1 className="text-4xl font-medium sm:text-5xl">
          {locale === 'zh'
            ? '纹身灵感，慢慢探索。'
            : 'Ideas worth exploring, before the ink.'}
        </h1>
        <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8">
          {locale === 'zh'
            ? '从一个想法到适合自己的设计。阅读风格、提示词和照片试戴指南，为下一次创作找到方向。'
            : 'From a first idea to a design that feels personal. Explore styles, prompts and photo try-on guides for your next concept.'}
        </p>
      </header>
      <TattooGuideLinks locale={locale} showAllLink={false} />
    </main>
  );
}
