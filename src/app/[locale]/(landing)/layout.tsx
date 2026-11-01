import { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { isProductPreview } from '@/config/preview/product';
import { previewStudioIsolated } from '@/server/studio/policy';
import { LocaleDetector, TopBanner } from '@/shared/blocks/common';
import { ActiveGenerationNotice } from '@/shared/blocks/tattoo/active-generation-notice';
import { PreviewBanner } from '@/shared/blocks/tattoo/preview-product';
import {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';

export default async function LandingLayout({
  children,
}: {
  children: ReactNode;
}) {
  // load page data
  const t = await getTranslations('landing');

  // load layout component
  const Layout = await getThemeLayout('landing');

  // header and footer to display (shared with the live site). In Preview the
  // account entry stays hidden until the owner certifies isolated account
  // resources via PREVIEW_STUDIO_ISOLATED — before that, sign-in would touch
  // non-isolated data and must not be offered.
  const preview = isProductPreview();
  const locale = await getLocale();
  const header: HeaderType = structuredClone(t.raw('header'));
  const footer: FooterType = structuredClone(t.raw('footer'));
  if (preview) {
    header.topbanner = undefined;
    if (!previewStudioIsolated()) {
      header.show_sign = false;
      header.user_nav = undefined;
    }
  }

  return (
    <Layout header={header} footer={footer}>
      {preview && <PreviewBanner locale={locale} />}
      <LocaleDetector />
      {header.topbanner && header.topbanner.text && (
        <TopBanner
          id="topbanner"
          text={header.topbanner?.text}
          buttonText={header.topbanner?.buttonText}
          href={header.topbanner?.href}
          target={header.topbanner?.target}
          closable
          rememberDismiss
          dismissedExpiryDays={header.topbanner?.dismissedExpiryDays ?? 1}
        />
      )}
      {!preview && <ActiveGenerationNotice />}
      {children}
    </Layout>
  );
}
