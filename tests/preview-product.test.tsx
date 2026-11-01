import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';

import pricingCopy from '@/config/locale/messages/en/pages/pricing.json';
import zhPricingCopy from '@/config/locale/messages/zh/pages/pricing.json';
import { isProductPreview, studioUrl } from '@/config/preview/product';
import {
  PreviewBanner,
  PreviewHome,
  PreviewPricing,
  ProductionHome,
} from '@/shared/blocks/tattoo/preview-product';
import { PricingCardData } from '@/shared/blocks/tattoo/pricing-cards';

vi.mock('@/shared/blocks/tattoo/tattoo-case-demo', () => ({
  TattooCaseDemo: () => <div />,
}));

function cardsFor(locale: string): PricingCardData[] {
  const copy =
    locale === 'zh' ? zhPricingCopy : (pricingCopy as typeof zhPricingCopy);
  return copy.page.sections.pricing.items.map(
    ({ title, price, credits, description, label, features }) => ({
      title,
      price,
      credits,
      description,
      label,
      features,
    })
  );
}

afterEach(() => vi.unstubAllEnvs());
it('enables product changes exclusively on Vercel Preview', () => {
  for (const env of ['production', 'development', '']) {
    vi.stubEnv('VERCEL_ENV', env);
    expect(isProductPreview()).toBe(false);
  }
  vi.stubEnv('VERCEL_ENV', 'preview');
  expect(isProductPreview()).toBe(true);
  expect(studioUrl()).toBe('/studio');
  expect(studioUrl('history')).toBe('/history');
  expect(studioUrl('designs')).toBe('/designs');
  expect(studioUrl('designs', 'zh')).toBe('/zh/designs');
});
it.each(['en', 'zh'])(
  'renders %s draft credits without a checkout or fixed image promise',
  (locale) => {
    const html = renderToStaticMarkup(
      <PreviewPricing locale={locale} cards={cardsFor(locale)} />
    );
    for (const text of ['$4.99', '$14.99', '$29.99', '1K', '2K', '4K'])
      expect(html).toContain(text);
    expect(html).toContain(`href="${studioUrl(undefined, locale)}"`);
    expect(html).not.toMatch(
      /checkout|data-product-id|<button|four images|四张/
    );
    expect(html).toContain(
      locale === 'zh' ? '不提供真实购买' : 'No real purchases'
    );
  }
);

it.each(['en', 'zh'])(
  'explains per-operation costs on every %s pricing card',
  (locale) => {
    const html = renderToStaticMarkup(
      <PreviewPricing locale={locale} cards={cardsFor(locale)} />
    );
    const zh = locale === 'zh';
    for (const credits of ['5', '20', '50']) expect(html).toContain(credits);
    expect(html).toContain(
      zh ? '上传、保存、复用与定位免费' : 'Upload, save, reuse and position free'
    );
    expect(html).toContain(zh ? '永不过期' : 'never expire');
    expect(html).toContain(
      zh ? '一次性购买' : 'One-time purchase'
    );
    // The middle card is highlighted as the recommended tier.
    expect(html).toContain(zh ? '最受欢迎' : 'Most Popular');
  }
);

it.each(['en', 'zh'])(
  'separates refund eligibility from order-specific credit recovery in %s pricing',
  (locale) => {
    const html = renderToStaticMarkup(
      <PreviewPricing locale={locale} cards={cardsFor(locale)} />
    );
    expect(html).toContain(
      locale === 'zh' ? '积分永不过期' : 'Credits never expire'
    );
    expect(html).toContain(
      locale === 'zh'
        ? '该订单剩余未用积分'
        : 'that order’s remaining unused credits'
    );
    expect(html).toContain(
      locale === 'zh'
        ? '部分退款人工处理'
        : 'Partial refunds require manual handling'
    );
    expect(html).toContain(
      locale === 'zh'
        ? '退款资格由支持团队另行审核'
        : 'support reviews refund eligibility separately'
    );
    expect(html).not.toMatch(
      /only for entirely unused|仅全部未使用|partially used packs require manual/
    );
  }
);
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => ({
    raw: (key: string) => {
      const sections = pricingCopy.page.sections as Record<
        string,
        { items?: unknown[] }
      >;
      const match = key.match(/^page\.sections\.(\w+)(?:\.(\w+))?$/);
      if (!match) return {};
      const section = sections[match[1]];
      if (!section) return {};
      return match[2] ? section[match[2] as 'items'] : section;
    },
  }),
}));
vi.mock('@/shared/lib/seo', () => ({ getMetadata: () => async () => ({}) }));
vi.mock('@/core/theme', () => ({
  getThemePage: async () => () => <div>Production page</div>,
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/shared/blocks/tattoo/generation-access', () => ({
  GenerationAccess: () => <div>Production generator</div>,
}));
vi.mock('@/shared/blocks/tattoo/tattoo-guide-links', () => ({
  TattooGuideLinks: () => <div />,
}));
vi.mock('@/shared/models/user', () => ({
  getUserInfo: vi.fn(() => {
    throw new Error('LIVE_ACCOUNT_ACCESSED');
  }),
}));
vi.mock('@/shared/models/subscription', () => ({
  getCurrentSubscription: vi.fn(() => {
    throw new Error('LIVE_SUBSCRIPTION_ACCESSED');
  }),
}));
vi.mock('@/server/db/tattoo-queries', () => ({
  countUserTattooProjects: vi.fn(),
  listUserTattooProjects: vi.fn(),
}));
vi.mock('@/lib/r2', () => ({ getPublicUrl: vi.fn() }));

it('routes Generate to the studio page and old studio panels to the standalone pages', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const { default: generate } =
    await import('@/app/[locale]/(landing)/generate/page');
  await expect(
    generate({ params: Promise.resolve({ locale: 'en' }) })
  ).rejects.toThrow('REDIRECT:/studio');
  await expect(
    generate({ params: Promise.resolve({ locale: 'zh' }) })
  ).rejects.toThrow('REDIRECT:/zh/studio');
  const { default: studio } =
    await import('@/app/[locale]/(landing)/studio/page');
  await expect(
    studio({
      params: Promise.resolve({ locale: 'zh' }),
      searchParams: Promise.resolve({ panel: 'history' }),
    })
  ).rejects.toThrow('REDIRECT:/zh/history');
  await expect(
    studio({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({ panel: 'designs' }),
    })
  ).rejects.toThrow('REDIRECT:/designs');
});
it('renders proposed Preview pricing before reading any live subscription or account', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const { default: page } =
    await import('@/app/[locale]/(landing)/pricing/page');
  const html = renderToStaticMarkup(
    await page({ params: Promise.resolve({ locale: 'en' }) })
  );
  expect(html).toContain('No real purchases');
});
it('routes production generation into the account studio', async () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const { default: generate } =
    await import('@/app/[locale]/(landing)/generate/page');
  await expect(
    generate({ params: Promise.resolve({ locale: 'en' }) })
  ).rejects.toThrow(`REDIRECT:${studioUrl(undefined, 'en')}`);
});
it.each(['en', 'zh'])(
  'updates Preview guides while preserving production guide copy in %s',
  async (locale) => {
    const { getTattooGuide } = await import('@/config/seo/tattoo-guides');
    vi.stubEnv('VERCEL_ENV', 'production');
    const original = getTattooGuide('first-tattoo', locale)!.sections[4].body;
    vi.stubEnv('VERCEL_ENV', 'preview');
    const preview = getTattooGuide('first-tattoo', locale)!.sections[4].body;
    expect(preview).toContain('KIE');
    expect(preview).not.toBe(original);
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(getTattooGuide('first-tattoo', locale)!.sections[4].body).toBe(
      original
    );
  }
);

it.each(['en', 'zh'])(
  'renders the %s home with account storage and isolated-preview disclosures',
  (locale) => {
    const zh = locale === 'zh';
    const home = renderToStaticMarkup(
      <PreviewHome locale={locale} accountsEnabled />
    );
    const banner = renderToStaticMarkup(<PreviewBanner locale={locale} />);
    expect(home).toContain(`href="${studioUrl(undefined, locale)}"`);
    expect(home).toContain('1K / 2K / 4K');
    expect(home).toContain(
      zh ? '自由移动' : 'Move, resize and rotate'
    );
    // Storage now lives in the account, never in this browser.
    expect(home).toContain(zh ? '保存在你的账户中' : 'saved to your account');
    expect(home).not.toMatch(
      /仅保存在当前浏览器|stay in this browser|test credits|测试积分/
    );
    expect(home).toContain(zh ? '注册领取 3 积分' : 'Sign up — get 3 free credits');
    // Without the isolation flag, sign-up waits and the note says so.
    const waiting = renderToStaticMarkup(
      <PreviewHome locale={locale} accountsEnabled={false} />
    );
    expect(waiting).toContain('PREVIEW_STUDIO_ISOLATED');
    expect(banner).toContain(
      zh ? '隔离数据库' : 'isolated database'
    );
    expect(banner).not.toMatch(/test credits|测试积分/);
  }
);

it.each(['en', 'zh'])(
  'renders production %s home with account persistence and live operation rates',
  (locale) => {
    vi.stubEnv('VERCEL_ENV', 'production');
    const html = renderToStaticMarkup(<ProductionHome locale={locale} />);
    expect(html).toContain('1K / 2K / 4K');
    expect(html).toContain(
      locale === 'zh' ? '账户设计库' : 'your account library'
    );
    expect(html).toContain(
      locale === 'zh' ? '积分永不过期' : 'Credits never expire'
    );
    expect(html).not.toMatch(
      /test credits|KIE|browser-local|this browser|测试积分|拟议|PREVIEW STUDIO/
    );
  }
);
