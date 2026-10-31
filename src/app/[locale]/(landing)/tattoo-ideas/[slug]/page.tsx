import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { locales } from '@/config/locale';
import { tattooGuideSlugs } from '@/config/seo/guide-paths';
import { getTattooGuide, getTattooGuides } from '@/config/seo/tattoo-guides';
import { getMetadata } from '@/shared/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };
export const revalidate = 86400;
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    tattooGuideSlugs.map((slug) => ({ locale, slug }))
  );
}
export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const guide = getTattooGuide(slug, locale);
  if (!guide) notFound();
  const titles: Record<string, string> = {
    minimalist: 'Minimalist Tattoo Ideas & Design Prompts | TattooVis',
    geometric: 'Geometric Tattoo Ideas & Wolf Design Prompts | TattooVis',
    'first-tattoo': 'First Tattoo Ideas: Design & Placement Guide | TattooVis',
  };
  return getMetadata({
    title: locale === 'zh' ? `${guide.title} | TattooVis` : titles[slug],
    description: guide.description,
    canonicalUrl: `/tattoo-ideas/${slug}`,
  })({ params });
}
export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const guide = getTattooGuide(slug, locale);
  if (!guide) notFound();
  const zh = locale === 'zh';
  return (
    <main className="px-5 pt-28 pb-20 sm:pt-36">
      <article className="mx-auto max-w-3xl">
        <nav
          aria-label={zh ? '面包屑导航' : 'Breadcrumb'}
          className="text-muted-foreground mb-8 flex flex-wrap gap-2 text-sm"
        >
          <Link href="/">TattooVis</Link>
          <span aria-hidden="true">/</span>
          <Link href="/tattoo-ideas" className="underline underline-offset-4">
            {zh ? '设计灵感' : 'Tattoo ideas'}
          </Link>
        </nav>
        <p className="text-primary mb-4 text-xs tracking-widest">
          DESIGN NOTES / TATTOOVIS
        </p>
        <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-5xl">
          {guide.title}
        </h1>
        <p className="text-muted-foreground mt-4 text-sm">
          {zh ? 'TattooVis 团队 · 更新于 ' : 'By the TattooVis team · Updated '}
          <time dateTime="2026-10-31">
            {zh ? '2026 年 10 月 31 日' : 'October 31, 2026'}
          </time>
        </p>
        <p className="mt-8 text-lg leading-relaxed">{guide.intro}</p>
        <nav
          aria-label={zh ? '本页内容' : 'On this page'}
          className="bg-muted/50 my-9 rounded-xl border p-5"
        >
          <p className="mb-3 text-sm font-medium">
            {zh ? '本页内容' : 'In this guide'}
          </p>
          <ul className="space-y-2 text-sm">
            {guide.sections.map((section, i) => (
              <li key={section.title}>
                <a
                  href={`#section-${i}`}
                  className="text-primary underline underline-offset-4"
                >
                  {section.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#prompts"
                className="text-primary underline underline-offset-4"
              >
                {zh ? '可修改的 AI 提示词' : 'Editable AI tattoo prompts'}
              </a>
            </li>
          </ul>
        </nav>
        {guide.sections.map((section, i) => (
          <section
            id={`section-${i}`}
            key={section.title}
            className="mt-10 scroll-mt-24"
          >
            <h2 className="mb-4 text-2xl font-semibold">{section.title}</h2>
            <p className="text-muted-foreground leading-8">{section.body}</p>
          </section>
        ))}
        {slug === 'geometric' && (
          <p className="mt-6">
            <Link
              href="/#tattoo-case"
              className="text-primary underline underline-offset-4"
            >
              {zh
                ? '打开几何狼头互动案例'
                : 'Explore the geometric wolf interactive example'}
            </Link>
          </p>
        )}
        <section id="prompts" className="mt-12 scroll-mt-24">
          <h2 className="text-2xl font-semibold">
            {zh ? '可修改的 AI 纹身提示词' : 'AI tattoo prompts to adapt'}
          </h2>
          <p className="text-muted-foreground mt-3 leading-7">
            {zh
              ? '复制一段到生成器，再替换主体、线条和构图。以下是提示词示例，不是已生成图片，也不保证每次输出相同。'
              : 'Copy a prompt into the generator, then change the subject, line style or composition. These are prompt examples, not generated image results or guaranteed outputs.'}
          </p>
          <div className="mt-6 space-y-5">
            {guide.prompts.map((prompt) => (
              <div key={prompt.title} className="bg-card rounded-xl border p-6">
                <h3 className="mb-3 text-lg font-medium">{prompt.title}</h3>
                <blockquote
                  lang="en"
                  className="border-primary/40 border-l-2 pl-4 leading-7 select-text"
                >
                  {prompt.text}
                </blockquote>
                <p className="text-muted-foreground mt-4 text-sm leading-6">
                  {prompt.note}
                </p>
              </div>
            ))}
          </div>
        </section>
        <section className="bg-muted/50 mt-12 rounded-2xl border p-7">
          <h2 className="text-xl font-semibold">
            {zh
              ? '用照片比较你的纹身想法'
              : 'Compare your tattoo idea on a photo'}
          </h2>
          <p className="text-muted-foreground mt-3 leading-7">
            {zh
              ? '可以先免费点击保存的案例。自己的图片生成需要账户和积分；目前新账户验证邮箱后一次性获赠三个积分。'
              : 'Explore the saved example free. Generating with your own photo requires an account and credits; new accounts receive three one-time credits after email verification.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-5 text-sm">
            <Link
              href="/generate"
              className="text-primary font-medium underline underline-offset-4"
            >
              {zh ? '打开纹身照片生成器' : 'Open the tattoo photo generator'}
            </Link>
            <Link href="/pricing" className="underline underline-offset-4">
              {zh
                ? '查看积分与分辨率价格'
                : 'Check credits and resolution pricing'}
            </Link>
          </div>
        </section>
        <nav aria-label={zh ? '相关指南' : 'Related guides'} className="mt-12">
          <h2 className="mb-5 text-xl font-semibold">
            {zh ? '继续探索设计' : 'Explore another design direction'}
          </h2>
          <ul className="space-y-3">
            {getTattooGuides(locale)
              .filter((item) => item.slug !== slug)
              .map((item) => (
                <li key={item.slug}>
                  <Link
                    href={`/tattoo-ideas/${item.slug}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      </article>
    </main>
  );
}
