// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({ getMetadata: () => async () => ({}) }));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
const signedIn = vi.hoisted(() => ({ value: false }));
vi.mock('@/shared/models/user', () => ({
  getUserInfo: vi.fn(async () => (signedIn.value ? { id: 'owner' } : undefined)),
}));
vi.mock('@/server/studio/service', () => ({
  studioCollection: vi.fn(async () => {
    throw new Error('DB must not be touched in these scenarios');
  }),
}));
vi.mock('@/core/db', () => ({
  db: vi.fn(() => {
    throw new Error('DB must not be touched in these scenarios');
  }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  signedIn.value = false;
});

const PAGES = [
  ['designs', 'My Designs'],
  ['history', 'Try-on History'],
] as const;

it.each(PAGES.map(([page]) => [page]))(
  'shows an explicit unavailable state without touching the database (%s)',
  async (page: 'designs' | 'history') => {
    const { default: Page } = await import(
      `@/app/[locale]/(landing)/${page}/page`
    );
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ locale: 'en' }) })
    );
    expect(html).toContain('PREVIEW_STUDIO_ISOLATED');
    expect(html).toContain('not enabled in this environment');
    expect(html).toContain('no fallback to browser-local storage');
  }
);

it.each(PAGES.map(([page]) => [page]))(
  'asks anonymous visitors to sign in once isolation is configured (%s)',
  async (page: 'designs' | 'history') => {
    vi.stubEnv('PREVIEW_STUDIO_ISOLATED', '1');
    const { default: Page } = await import(
      `@/app/[locale]/(landing)/${page}/page`
    );
    const html = renderToStaticMarkup(
      await Page({ params: Promise.resolve({ locale: 'en' }) })
    );
    expect(html).toContain('Sign in');
    expect(html).toContain(`callbackUrl=/${page}`);
  }
);

it.each([
  ['designs', '我的图案'],
  ['history', '试戴历史'],
] as const)('renders the %s page in Chinese', async (page: 'designs' | 'history', title: string) => {
  vi.stubEnv('PREVIEW_STUDIO_ISOLATED', '1');
  const { default: Page } = await import(
    `@/app/[locale]/(landing)/${page}/page`
  );
  const html = renderToStaticMarkup(
    await Page({ params: Promise.resolve({ locale: 'zh' }) })
  );
  expect(html).toContain(title);
  expect(html).toContain('登录');
});
