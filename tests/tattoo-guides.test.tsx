import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { getTattooGuide, getTattooGuides } from '@/config/seo/tattoo-guides';

vi.mock('next-intl/server', () => ({ setRequestLocale: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/shared/lib/seo', () => ({ getMetadata: () => async () => ({}) }));

it.each(['en', 'zh'])(
  'renders all %s guide content, prompts and internal links in server HTML',
  async (locale) => {
    const { default: Page } =
      await import('@/app/[locale]/(landing)/tattoo-ideas/[slug]/page');
    for (const guide of getTattooGuides(locale)) {
      const html = renderToStaticMarkup(
        await Page({ params: Promise.resolve({ locale, slug: guide.slug }) })
      );
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html.match(/<blockquote[ >]/g)).toHaveLength(3);
      expect(html).toContain('href="/generate"');
      expect(html).toContain('href="/pricing"');
      expect(html).toContain(guide.sections[0].title);
      expect(html).not.toContain('/try-on-lab');
    }
  }
);

it('rejects unknown guide slugs instead of publishing a generic duplicate page', async () => {
  expect(getTattooGuide('not-real', 'en')).toBeUndefined();
  const { default: Page } =
    await import('@/app/[locale]/(landing)/tattoo-ideas/[slug]/page');
  await expect(
    Page({ params: Promise.resolve({ locale: 'en', slug: 'not-real' }) })
  ).rejects.toThrow('NEXT_NOT_FOUND');
});
