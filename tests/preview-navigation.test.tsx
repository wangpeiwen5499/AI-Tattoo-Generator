// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { previewNavigation } from '@/config/preview/navigation';
import { PreviewSiteNavigation } from '@/shared/blocks/tattoo/preview-site-navigation';

import { createStudioI18n } from '../public/try-on-lab/i18n.mjs';
import { initStudioNavigation } from '../public/try-on-lab/navigation.mjs';

const route = vi.hoisted(() => ({ path: '/blog/first-tattoo' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

it.each(['en', 'zh'])(
  'uses the same text-only navigation in the %s landing and studio headers',
  (locale) => {
    const { container, unmount } = render(
      <PreviewSiteNavigation locale={locale} />
    );
    const expected = previewNavigation(locale);
    expect(container.querySelector('svg')).toBeNull();
    expect(
      screen
        .getByRole('link', { name: locale === 'zh' ? '博客' : 'Blog' })
        .getAttribute('aria-current')
    ).toBe('page');
    for (const link of expected.links) {
      expect(
        screen.getByRole('link', { name: link.label }).getAttribute('href')
      ).toBe(link.href);
    }
    unmount();
    document.body.innerHTML = new DOMParser().parseFromString(
      readFileSync('public/try-on-lab/index.html', 'utf8'),
      'text/html'
    ).body.innerHTML;
    const i18n = createStudioI18n(locale);
    i18n.apply();
    initStudioNavigation({ locale, t: i18n.t });
    const header = document.querySelector('.site-navigation')!;
    expect(header.querySelector('svg')).toBeNull();
    expect(header.textContent).not.toContain('Preview');
    for (const link of expected.links)
      expect(header.textContent).toContain(link.label);
    expect(document.getElementById('nav-pricing')!.getAttribute('href')).toBe(
      locale === 'zh' ? '/zh/pricing' : '/pricing'
    );
    expect(
      header.querySelector('[data-site-path="#features"]')!.getAttribute('href')
    ).toBe(`${expected.home}#features`);
    expect(
      header.querySelector('[data-site-path="/blog"]')!.getAttribute('href')
    ).toBe(locale === 'zh' ? '/zh/blog' : '/blog');
    expect(header.querySelector('.brand')!.getAttribute('href')).toBe(
      expected.home
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

it('opens the landing menu, closes on Escape with focus returned, and closes after navigation', () => {
  render(<PreviewSiteNavigation locale="en" />);
  const toggle = screen.getByRole('button', { name: 'Menu' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(toggle.textContent).toBe('Close');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(toggle);
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('link', { name: 'Blog' }));
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
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
