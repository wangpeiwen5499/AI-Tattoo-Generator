// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import React from 'react';
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';

import landingEn from '@/config/locale/messages/en/landing.json';
import { STUDIO_BODY_HTML } from '@/shared/blocks/tattoo/studio-markup';
import landingZh from '@/config/locale/messages/zh/landing.json';
import { Header as HeaderType } from '@/shared/types/blocks/landing';
import LandingLayout from '@/themes/default/layouts/landing';

const route = vi.hoisted(() => ({ path: '/designs' }));
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

it.each(['en', 'zh'] as const)(
  'renders the shared site Header pointing at the studio and standalone pages (%s)',
  (locale) => {
    const header = (
      locale === 'zh' ? landingZh.header : landingEn.header
    ) as unknown as HeaderType;
    const footer = {
      ...(locale === 'zh' ? landingZh.footer : landingEn.footer),
      show_locale: false,
      show_theme: false,
    } as never;
    const { container, unmount } = render(
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
    expect(container.querySelector('header')).toBeTruthy();
    expect(container.textContent).toContain('TattooVis');
    const zh = locale === 'zh';
    const labels = [
      zh ? '功能' : 'Features',
      zh ? '博客' : 'Blog',
      zh ? '价格' : 'Pricing',
      zh ? '工作室' : 'Studio',
      zh ? '历史' : 'History',
      zh ? '我的设计' : 'My Designs',
    ];
    for (const label of labels) expect(container.textContent).toContain(label);
    const hrefs = [...container.querySelectorAll('a')].map((a) =>
      a.getAttribute('href')
    );
    expect(hrefs).toContain('/studio');
    expect(hrefs).toContain('/history');
    expect(hrefs).toContain('/designs');
    // No link may deep-link into the editor with an auto-opened panel dialog.
    expect(hrefs.some((href) => href?.includes('panel='))).toBe(false);
    unmount();
  }
);

it('legacy /try-on-lab entry hands off to app pages without a gallery panel', () => {
  const html = readFileSync('public/try-on-lab/index.html', 'utf8');
  // The stub maps old panel deep links to the standalone pages and keeps lang.
  expect(html).toContain('?panel=');
  expect(html).toContain("panel === 'designs' || panel === 'history'");
  expect(html).toContain("'/' + panel");
  expect(html).toContain('/studio');
});

it('the studio body markup contains no local-library or test-wallet remnants', () => {
  const body = STUDIO_BODY_HTML;
  for (const banned of [
    'test-wallet',
    'grant-test-credits',
    'release-orphaned-credit',
    'test-config',
    'class="consent"',
    'access-token',
  ]) {
    expect(body).not.toContain(banned);
  }
  // The editor keeps its interactive surface…
  for (const needed of [
    'id="stage"',
    'id="prompt"',
    'id="render"',
    'id="open-design-library"',
    'id="detail-dialog"',
  ]) {
    expect(body).toContain(needed);
  }
});
