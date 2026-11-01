import { getTranslations, setRequestLocale } from 'next-intl/server';

import { isProductPreview } from '@/config/preview/product';
import { previewStudioIsolated } from '@/server/studio/policy';
import {
  PreviewHome,
  ProductionHome,
} from '@/shared/blocks/tattoo/preview-product';
import { getMetadata } from '@/shared/lib/seo';

export const revalidate = 3600;
export const generateMetadata = getMetadata({ canonicalUrl: '/' });

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('pages.index');
  if (isProductPreview())
    return (
      <PreviewHome
        locale={locale}
        reviews={t.raw('page.sections.testimonials')}
        accountsEnabled={previewStudioIsolated()}
      />
    );
  return (
    <ProductionHome locale={locale} reviews={t.raw('page.sections.testimonials')} />
  );
}
