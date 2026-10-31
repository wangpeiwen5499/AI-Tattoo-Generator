import { ReactNode } from 'react';
import { getLocale, getTranslations } from 'next-intl/server';

import { getThemeLayout } from '@/core/theme';
import { isProductPreview } from '@/config/preview/product';
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

  // header and footer to display
  const preview = isProductPreview();
  const locale = await getLocale();
  const zh = locale === 'zh';
  const header: HeaderType = structuredClone(t.raw('header'));
  const footer: FooterType = structuredClone(t.raw('footer'));
  if (preview) {
    header.show_sign = false;
    header.user_nav = undefined;
    header.topbanner = undefined;
    header.nav = {
      ...header.nav,
      items: [
        ...(header.nav?.items ?? []),
        {
          title: zh ? '我的设计' : 'My designs',
          url: '/designs',
          icon: 'Images',
        },
      ],
    };
    if (footer.brand)
      footer.brand.description = zh
        ? '先设计，再自由定位。Preview 设计库与试戴历史仅保存在当前浏览器。'
        : 'Create a design, place it freely. Preview designs and try-on history stay in this browser.';
    footer.nav = {
      ...footer.nav,
      items: (footer.nav?.items ?? []).map((item, i) =>
        i === 0
          ? {
              ...item,
              children: [
                ...(item.children ?? []),
                { title: zh ? '我的设计' : 'My designs', url: '/designs' },
                { title: zh ? '试戴历史' : 'Try-on history', url: '/history' },
              ],
            }
          : item
      ),
    };
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
