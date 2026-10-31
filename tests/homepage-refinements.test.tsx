import React from 'react';
import LandingPage from '@/app/[locale]/(landing)/page';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import indexCopy from '@/config/locale/messages/en/pages/index.json';
import { PreviewHome } from '@/shared/blocks/tattoo/preview-product';

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
  getTranslations: async () => ({ raw: () => indexCopy.page }),
}));
vi.mock('@/config/preview/product', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isProductPreview: () => false,
}));
vi.mock('@/shared/lib/seo', () => ({ getMetadata: () => vi.fn() }));
vi.mock('@/core/theme', () => ({
  getThemePage:
    async () =>
    ({ page }: { page: { sections: Record<string, unknown> } }) => (
      <div>{Object.keys(page.sections).join(',')}</div>
    ),
}));

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: React.ComponentProps<'a'>) => (
    <a {...props}>{children}</a>
  ),
}));
it('places blog articles before reviews and renders initials instead of avatar images', () => {
  const html = renderToStaticMarkup(
    <PreviewHome
      locale="en"
      reviews={{
        id: 'testimonials',
        title: 'What Our Users Say',
        items: [
          { name: 'Alex M.', quote: 'Layout sample' },
          { name: 'Sarah K.', quote: 'Layout sample' },
        ],
      }}
    />
  );
  expect(html.indexOf('id="blog"')).toBeLessThan(
    html.indexOf('id="testimonials"')
  );
  expect(html).toContain('href="/blog"');
  expect(html).toContain('>A</span>');
  expect(html).toContain('>S</span>');
  expect(html).not.toContain('/imgs/avatars/');
  expect(html).not.toContain('Trusted by tattoo enthusiasts worldwide');
});

it('also preserves blog-before-reviews ordering in the standard landing renderer', async () => {
  const html = renderToStaticMarkup(
    await LandingPage({ params: Promise.resolve({ locale: 'en' }) })
  );
  expect(html).toContain('features,blog,testimonials,faq');
  expect(indexCopy.page.sections).not.toHaveProperty('blog');
});
