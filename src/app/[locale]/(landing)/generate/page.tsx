import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { Link } from '@/core/i18n/navigation';
import { isProductPreview, studioUrl } from '@/config/preview/product';
import { GenerationAccess } from '@/shared/blocks/tattoo/generation-access';
import { TattooGuideLinks } from '@/shared/blocks/tattoo/tattoo-guide-links';
import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 3600;

type Props = { params: Promise<{ locale: string }> };
export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return getMetadata({
    title:
      locale === 'zh'
        ? '纹身照片模拟器：生成并预览你的设计 | TattooVis'
        : 'Tattoo Simulator: Preview Designs on Your Photo | TattooVis',
    description: isProductPreview()
      ? locale === 'zh'
        ? '上传或生成纹身图案，在自己的照片上自由定位，再生成单张真实试戴。设计、试戴分阶段使用独立测试积分，保存与复用免费。'
        : 'Upload or create a tattoo design, place it freely on your photo and generate one realistic try-on. Design and rendering use separate test credits; saving and reuse are free.'
      : locale === 'zh'
        ? '上传清晰照片并描述纹身想法，比较左臂、右臂、肩部与小腿效果。先体验真实案例，自己的图片生成需要账户及积分。'
        : 'Upload a clear photo and describe your tattoo idea. Compare arm, shoulder and calf previews, explore the real example and check credit costs before generating.',
    canonicalUrl: '/generate',
  })({ params });
}

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (isProductPreview()) redirect(studioUrl(undefined, locale));

  const zh = locale === 'zh';
  return (
    <main>
      <section className="mx-auto max-w-3xl px-5 pt-28 text-center sm:pt-36">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {zh
            ? '用自己的照片预览 AI 纹身设计'
            : 'Preview your design with an AI tattoo simulator'}
        </h1>
        <p className="text-muted-foreground mt-5 leading-7">
          {zh
            ? '描述想要的纹身，比较设计在左臂、右臂、肩部和小腿的预览效果。使用清晰、光线均匀且这些区域可见的照片。AI 结果是设计参考，可能改动纹身之外的画面。'
            : 'Describe a custom tattoo and compare previews on the left arm, right arm, shoulder and calf. Use a clear, evenly lit photo with those areas visible. AI results are visual references and may change details outside the tattoo.'}
        </p>
        <p className="mt-4 text-sm">
          <Link
            href="/tattoo-ideas"
            className="text-primary underline underline-offset-4"
          >
            {zh
              ? '需要灵感？浏览纹身设计与提示词指南'
              : 'Need a starting point? Explore tattoo ideas and prompt guides'}
          </Link>
        </p>
      </section>
      <div className="[&>section]:pt-8">
        <GenerationAccess />
      </div>
      <TattooGuideLinks locale={locale} compact />
    </main>
  );
}
