import { setRequestLocale } from 'next-intl/server';

import { ManualEditor } from '@/shared/blocks/tattoo/manual-editor';
import { getMetadata } from '@/shared/lib/seo';

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return getMetadata({
    title:
      locale === 'zh'
        ? '免费手动纹身试戴 | TattooVis'
        : 'Free Tattoo Try-on Editor | TattooVis',
    description:
      locale === 'zh'
        ? '在自己的照片上免费摆放纹身图案，调整大小、角度和深浅，下载手动预览。无需登录或积分。'
        : 'Place a tattoo design on your own photo for free. Move, resize, rotate and adjust ink, then download your manual preview. No sign-in or credits.',
    canonicalUrl: '/studio',
  })({ params });
}
export default async function StudioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="container pt-24 sm:pt-28">
      <header className="max-w-3xl">
        <p className="text-primary mb-3 text-sm">
          {locale === 'zh' ? '免费 · 无需登录' : 'FREE · NO SIGN-IN REQUIRED'}
        </p>
        <h1 className="text-4xl font-medium sm:text-5xl">
          {locale === 'zh'
            ? '先摆放，再决定。'
            : 'Find your placement, before the ink.'}
        </h1>
        <p className="text-muted-foreground mt-5 text-lg leading-8">
          {locale === 'zh'
            ? '上传照片和已有图案，直接在照片上自由试戴。这一步完全免费，不消耗积分。'
            : 'Bring your photo and an existing design. Explore size, angle and placement directly on your skin — completely free, with no credits.'}
        </p>
      </header>
      <ManualEditor locale={locale} />
    </main>
  );
}
