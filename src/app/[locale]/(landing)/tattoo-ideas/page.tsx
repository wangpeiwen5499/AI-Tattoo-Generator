import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { TattooGuideLinks } from '@/shared/blocks/tattoo/tattoo-guide-links';
import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 86400;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return getMetadata({
    title:
      locale === 'zh'
        ? '纹身设计灵感与 AI 提示词指南 | TattooVis'
        : 'Tattoo Design Ideas & AI Prompt Guides | TattooVis',
    description:
      locale === 'zh'
        ? '探索极简、几何和第一次纹身设计，参考可修改提示词，用自己的照片比较预览效果，为与纹身师讨论做好准备。'
        : 'Explore minimalist, geometric and first tattoo ideas with editable AI prompts, photo-preview tips and practical questions to discuss with your tattoo artist.',
    canonicalUrl: '/tattoo-ideas',
  })({ params });
}
export default async function IdeasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const zh = locale === 'zh';
  return (
    <main className="pt-28 sm:pt-36">
      <div className="mx-auto max-w-4xl px-5">
        <p className="text-primary mb-4 text-xs tracking-widest">
          TATTOOVIS / DESIGN NOTES
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          {zh
            ? '把纹身灵感变成具体的设计'
            : 'Tattoo design ideas, made personal'}
        </h1>
        <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
          {zh
            ? '从喜欢的主题和风格出发，用明确的提示词探索设计，再在照片上检查构图。这里的指南是创作参考，不是实际纹身效果的保证。'
            : 'Start with a subject you care about, explore a visual direction and write a clearer prompt. These guides help you develop a reference and evaluate a photo preview before talking to an artist.'}
        </p>
        <div className="mt-7 flex flex-wrap gap-5 text-sm">
          <Link
            href="/generate"
            className="text-primary font-medium underline underline-offset-4"
          >
            {zh ? '打开 AI 纹身生成器' : 'Open the AI tattoo generator'}
          </Link>
          <Link href="/#tattoo-case" className="underline underline-offset-4">
            {zh ? '查看真实狼头案例' : 'Explore the real wolf tattoo example'}
          </Link>
        </div>
      </div>
      <TattooGuideLinks locale={locale} />
    </main>
  );
}
