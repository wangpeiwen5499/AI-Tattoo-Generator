import { getTranslations, setRequestLocale } from 'next-intl/server';

import { getThemePage } from '@/core/theme';
import { isProductPreview } from '@/config/preview/product';
import { PreviewPricing } from '@/shared/blocks/tattoo/preview-product';
import { BuyPackButton } from '@/shared/blocks/tattoo/buy-pack-button';
import {
  PricingCardData,
  PricingCards,
} from '@/shared/blocks/tattoo/pricing-cards';
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
  if (isProductPreview()) {
    const t = await getTranslations('pages.pricing');
    const cards = (
      t.raw('page.sections.pricing.items') as PricingCardData[]
    ).map(({ title, price, credits, description, label, features }) => ({
      title,
      price,
      credits,
      description,
      label,
      features,
    }));
    return <PreviewPricing locale={locale} cards={cards} />;
  }

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

  // get pricing data — the shared cards carry the pack copy; the production
  // mode injects the real checkout action, Preview renders a passive CTA.
  const t = await getTranslations('pages.pricing');
  const rawItems = t.raw('page.sections.pricing.items') as Array<
    PricingCardData & {
      product_id?: string;
      currency?: string;
      button?: { title?: string };
    }
  >;
  const cards: PricingCardData[] = rawItems.map(
    ({ title, price, credits, description, label, features }) => ({
      title,
      price,
      credits,
      description,
      label,
      features,
    })
  );

  // FAQ section still comes from the dynamic page config.
  const page: DynamicPage = {
    sections: {
      faq: t.raw('page.sections.faq'),
    },
  };
  const Page = await getThemePage('dynamic-page');

  return (
    <>
      <section className="tattoo-section pb-0">
        <div className="tattoo-container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="tattoo-heading">
              {locale === 'zh'
                ? '按操作使用积分，设计自由复用'
                : 'Credits per operation. Designs you can reuse.'}
            </h1>
            <p className="tattoo-section-body">
              {locale === 'zh'
                ? '1K 设计：1 积分。单张 1K / 2K / 4K 试戴：1 / 2 / 3 积分。上传、保存、复用与定位免费。积分永不过期；图片数量取决于所选操作与分辨率。'
                : '1K design: 1 credit. Single 1K / 2K / 4K try-on: 1 / 2 / 3 credits. Upload, save, reuse and position free. Credits never expire; image counts depend on your operations and resolutions.'}
            </p>
            <div className="mt-12">
              <PricingCards
                cards={cards}
                renderCta={(card, _featured) => (
                  <BuyPackButton
                    productId={rawItems.find((item) => item.title === card.title)?.product_id}
                    currency={rawItems.find((item) => item.title === card.title)?.currency}
                    title={
                      rawItems.find((item) => item.title === card.title)?.button
                        ?.title || 'Buy'
                    }
                    locale={locale}
                  />
                )}
              />
            </div>
          </div>
        </div>
      </section>
      <Page locale={locale} page={page} />
    </>
  );
}
