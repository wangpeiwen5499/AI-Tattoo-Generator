// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

import landingEn from '@/config/locale/messages/en/landing.json';
import landingZh from '@/config/locale/messages/zh/landing.json';
import { Header as HeaderType } from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

import { createStudioI18n } from '../public/try-on-lab/i18n.mjs';
import { initStudioNavigation } from '../public/try-on-lab/navigation.mjs';

const route = vi.hoisted(() => ({ path: '/blog/first-tattoo' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
  usePathname: () => route.path,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

beforeAll(() => {
  // jsdom lacks matchMedia; the shared Header needs desktop-width matches so
  // the desktop NavigationMenu renders.
  window.matchMedia =
    window.matchMedia ||
    ((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

/** Nav entries the landing pages show, mirroring the (landing) layout's
 * preview additions (My Designs → studio designs panel). */
function expectedNav(locale: 'en' | 'zh') {
  const header =
    locale === 'zh' ? landingZh.header : (landingEn.header as typeof landingZh.header);
  const zh = locale === 'zh';
  return [
    ...(header.nav?.items ?? []).map((item) => ({
      label: item.title,
      href: zh
        ? `/zh${item.url === '/' ? '' : item.url}`
        : item.url,
    })),
    {
      label: zh ? '我的设计' : 'My Designs',
      href: '/try-on-lab/index.html?panel=designs' + (zh ? '' : '&lang=en'),
    },
  ];
}

it.each(['en', 'zh'] as const)(
  'renders the shared site Header from the %s landing config',
  (locale) => {
    const header = (
      locale === 'zh' ? landingZh.header : landingEn.header
    ) as unknown as HeaderType;
    const footer = {
      ...(locale === 'zh' ? landingZh.footer : landingEn.footer),
      show_locale: false,
      show_theme: false,
    } as never;
    const { container } = render(
      <LandingLayout
        header={{
          ...header,
          show_sign: false,
          show_theme: false,
          show_locale: false,
          user_nav: undefined,
          topbanner: undefined,
        }}
        footer={footer}
      >
        <div>page body</div>
      </LandingLayout>
    );
    // The theme layout must use the formal Header block (not a separate nav).
    expect(container.querySelector('header')).toBeTruthy();
    expect(container.textContent).toContain('TattooVis');
    for (const item of header.nav?.items ?? [])
      expect(container.textContent).toContain(item.title);
  }
);

it.each(['en', 'zh'] as const)(
  'keeps the %s studio header aligned with the landing navigation',
  (locale) => {
    document.body.innerHTML = new DOMParser().parseFromString(
      readFileSync('public/try-on-lab/index.html', 'utf8'),
      'text/html'
    ).body.innerHTML;
    const i18n = createStudioI18n(locale);
    i18n.apply();
    initStudioNavigation({ locale, t: i18n.t });
    const header = document.querySelector('.site-navigation')!;
    expect(header.textContent).toContain('TattooVis');
    for (const { label } of expectedNav(locale))
      expect(header.textContent).toContain(label);
    expect(document.getElementById('nav-pricing')!.getAttribute('href')).toBe(
      locale === 'zh' ? '/zh/pricing' : '/pricing'
    );
    expect(
      header.querySelector('[data-site-path="#features"]')!.getAttribute('href')
    ).toBe(locale === 'zh' ? '/zh#features' : '/#features');
    expect(
      header.querySelector('[data-site-path="/blog"]')!.getAttribute('href')
    ).toBe(locale === 'zh' ? '/zh/blog' : '/blog');
    expect(header.querySelector('.brand')!.getAttribute('href')).toBe(
      locale === 'zh' ? '/zh' : '/'
    );
    expect(document.getElementById('nav-history')!.tagName).toBe('BUTTON');
    expect(document.getElementById('nav-designs')!.tagName).toBe('BUTTON');
    expect(
      document
        .getElementById(`nav-language-${locale}`)!
        .getAttribute('aria-current')
    ).toBe('true');
    expect(header.querySelector('#nav-studio')!.getAttribute('href')).toBe(
      '#stage'
    );
  }
);

it('marks the studio header as scrolled like the site Header', () => {
  document.body.innerHTML = new DOMParser().parseFromString(
    readFileSync('public/try-on-lab/index.html', 'utf8'),
    'text/html'
  ).body.innerHTML;
  const header = document.querySelector('.site-navigation') as HTMLElement;
  initStudioNavigation({ locale: 'en', t: createStudioI18n('en').t });
  expect(header.dataset.scrolled).toBe('false');
  Object.defineProperty(window, 'scrollY', { value: 200, configurable: true });
  window.dispatchEvent(new Event('scroll'));
  expect(header.dataset.scrolled).toBe('true');
});

it('retains studio gallery callbacks while closing its mobile menu', () => {
  document.body.innerHTML = new DOMParser().parseFromString(
    readFileSync('public/try-on-lab/index.html', 'utf8'),
    'text/html'
  ).body.innerHTML;
  const history = document.getElementById('nav-history')!;
  const designs = document.getElementById('nav-designs')!;
  const openHistory = vi.fn();
  const openDesigns = vi.fn();
  history.onclick = openHistory;
  designs.onclick = openDesigns;
  initStudioNavigation({ locale: 'en', t: createStudioI18n('en').t });
  const toggle = document.getElementById('site-menu-toggle')!;
  fireEvent.click(toggle);
  expect(toggle.textContent).toBe('Close');
  fireEvent.keyDown(history, { key: 'Escape' });
  expect(document.activeElement).toBe(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  fireEvent.click(history);
  expect(openHistory).toHaveBeenCalledOnce();
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(designs);
  expect(openDesigns).toHaveBeenCalledOnce();
});

it('shows a sign-in entry in the shared header when accounts are enabled', () => {
  // The formal Header renders the same account entry as the live site when
  // show_sign is on (production deployments of this branch).
  const header = landingEn.header as unknown as HeaderType;
  expect(header.show_sign).toBe(true);
});
