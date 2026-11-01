import sitemap from '@/app/sitemap';
import { expect, it, vi } from 'vitest';

import { getTattooGuide, getTattooGuides } from '@/config/seo/tattoo-guides';

vi.mock('@/config', () => ({
  envConfigs: { app_url: 'https://tattoovis.ink', locale: 'en' },
}));

it('provides the three complete guides in both languages without unknown routes', () => {
  for (const locale of ['en', 'zh']) {
    const guides = getTattooGuides(locale);
    expect(guides.map((guide) => guide.slug)).toEqual([
      'minimalist',
      'geometric',
      'first-tattoo',
    ]);
    for (const guide of guides) {
      expect(guide.sections.length).toBeGreaterThan(2);
      expect(guide.prompts).toHaveLength(3);
      expect(getTattooGuide(guide.slug, locale)?.title).toBe(guide.title);
    }
    expect(getTattooGuide('missing-article', locale)).toBeUndefined();
  }
  expect(getTattooGuide('first-tattoo', 'zh')?.title).not.toBe(
    getTattooGuide('first-tattoo', 'en')?.title
  );
});

it('lists canonical blog and guide URLs with locale alternates, excluding the alias', () => {
  const entries = sitemap();
  for (const prefix of ['', '/zh']) {
    for (const path of [
      '/blog',
      '/tattoo-ideas/minimalist',
      '/tattoo-ideas/geometric',
      '/tattoo-ideas/first-tattoo',
    ]) {
      const entry = entries.find(
        (item) => item.url === `https://tattoovis.ink${prefix}${path}`
      );
      expect(entry?.alternates?.languages).toMatchObject({
        en: `https://tattoovis.ink${path}`,
        zh: `https://tattoovis.ink/zh${path}`,
      });
    }
  }
  expect(entries.some((item) => /\/tattoo-ideas$/.test(item.url))).toBe(false);
});
