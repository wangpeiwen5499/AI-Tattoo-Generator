import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { isProductPreview } from '@/config/preview/product';
import { PreviewPricing } from '@/shared/blocks/tattoo/preview-product';
import { getMetadata } from '@/shared/lib/seo';
import { getCurrentSubscription } from '@/shared/models/subscription';
import { getUserInfo } from '@/shared/models/user';
import { DynamicPage } from '@/shared/types/blocks/landing';

export const revalidate = 3600;

export const generateMetadata = getMetadata({
  metadataKey: 'pages.pricing.metadata',
  canonicalUrl: '/pricing',
});

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (isProductPreview()) return <PreviewPricing locale={locale} />;

  // get current subscription
  let currentSubscription;
  try {
    const user = await getUserInfo();
    if (user) {
      currentSubscription = await getCurrentSubscription(user.id);
    }
  } catch (error) {
    console.log('getting current subscription failed:', error);
  }

  // get pricing data
  const t = await getTranslations('pages.pricing');

  // build page sections
  const page: DynamicPage = {
    sections: {
      pricing: {
        ...t.raw('page.sections.pricing'),
        data: {
          currentSubscription,
        },
      },
      faq: t.raw('page.sections.faq'),
    },
  };

  // load page component
  const Page = await getThemePage('dynamic-page');

  return (
    <>
      <section className="mx-auto max-w-3xl px-5 pt-28 text-center">
        <h1 className="text-3xl font-semibold">
          {locale === 'zh'
            ? '按操作使用积分，设计自由复用'
            : 'Credits per operation. Designs you can reuse.'}
        </h1>
        <p className="text-muted-foreground mt-5 leading-7">
          {locale === 'zh'
            ? '1K 设计：1 积分。单张 1K / 2K / 4K 试戴：1 / 2 / 3 积分。上传、保存、复用与定位免费。积分永不过期；图片数量取决于所选操作与分辨率。'
            : '1K design: 1 credit. Single 1K / 2K / 4K try-on: 1 / 2 / 3 credits. Upload, save, reuse and position free. Credits never expire; image counts depend on your operations and resolutions.'}
        </p>
      </section>
      <Page locale={locale} page={page} />
    </>
  );
}
