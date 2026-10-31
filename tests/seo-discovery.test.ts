import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/config', () => ({
  envConfigs: {
    app_url: 'https://tattoovis.ink/',
    app_name: 'TattooVis',
    app_preview_image: '/preview.png',
  },
}));
vi.mock('@/config/locale', () => ({
  defaultLocale: 'en',
  locales: ['en', 'zh'],
}));
vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () =>
    Object.assign(
      (key: string) =>
        ({ title: 'TattooVis', description: 'Tattoo previews', keywords: '' })[
          key as 'title'
        ],
      { has: () => true }
    ),
}));

beforeEach(() => {
  vi.unstubAllEnvs();
});

it('gives public pages reciprocal localized canonical and hreflang URLs without double slashes', async () => {
  const { getMetadata } = await import('@/shared/lib/seo');
  const make = getMetadata({ canonicalUrl: '/generate' });
  const en = await make({ params: Promise.resolve({ locale: 'en' }) });
  const zh = await make({ params: Promise.resolve({ locale: 'zh' }) });
  expect(en.alternates.canonical).toBe('https://tattoovis.ink/generate');
  expect(zh.alternates.canonical).toBe('https://tattoovis.ink/zh/generate');
  expect(en.alternates.languages).toEqual(zh.alternates.languages);
  expect(en.alternates.languages?.['x-default']).toBe(en.alternates.canonical);
});

it('prevents Preview metadata from becoming an indexed copy of production', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const { getMetadata } = await import('@/shared/lib/seo');
  const metadata = await getMetadata()({
    params: Promise.resolve({ locale: 'en' }),
  });
  expect(metadata.robots.index).toBe(false);
});

it('discovers useful guides in both languages and excludes private and experimental URLs', async () => {
  const { default: sitemap } = await import('@/app/sitemap');
  const urls = sitemap().map((entry) => entry.url);
  expect(urls).toContain('https://tattoovis.ink/tattoo-ideas/geometric');
  expect(urls).toContain('https://tattoovis.ink/zh/tattoo-ideas/minimalist');
  expect(urls.some((url) => /history|try-on-lab|settings/.test(url))).toBe(
    false
  );
  expect(new Set(urls).size).toBe(urls.length);
  expect(urls).toContain('https://tattoovis.ink/zh');
  expect(urls).not.toContain('https://tattoovis.ink/zh/');
});
