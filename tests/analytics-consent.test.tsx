// @vitest-environment jsdom
import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import {
  CONSENT_KEY,
  readAnalyticsConsent,
  sanitizedPage,
} from '@/extensions/analytics/consent';
import {
  CookieSettingsButton,
  GoogleAnalyticsConsent,
} from '@/extensions/analytics/google-consent';

const route = vi.hoisted(() => ({ pathname: '/studio' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
beforeEach(() => {
  localStorage.clear();
  route.pathname = '/studio';
  delete (window as any).gtag;
  delete (window as any).dataLayer;
  document.documentElement.lang = 'en';
});
afterEach(() => {
  cleanup();
  document
    .querySelectorAll('script[data-ga-consent]')
    .forEach((s) => s.remove());
  vi.restoreAllMocks();
});
it('blocks GA until explicit acceptance and persists necessary-only without loading it', () => {
  render(<GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />);
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  expect((window as any).dataLayer).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }));
  expect(readAnalyticsConsent(localStorage)).toBe('necessary');
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  expect(
    screen.queryByRole('region', { name: 'Cookie preferences' })
  ).toBeNull();
});
it('accepts with one loader, sends sanitized pageviews once, and revokes without reloading', () => {
  const view = render(
    <>
      <GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />
      <CookieSettingsButton />
    </>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  expect(
    document.querySelectorAll('script[src*="googletagmanager"]')
  ).toHaveLength(1);
  expect(readAnalyticsConsent(localStorage)).toBe('analytics');
  const entries = () =>
    ((window as any).dataLayer as IArguments[]).map((args) => Array.from(args));
  const pages = () =>
    entries().filter((args) => args[0] === 'event' && args[1] === 'page_view');
  expect(pages()).toHaveLength(1);
  expect(pages()[0][2]).toMatchObject({
    page_path: '/studio',
    page_referrer: '',
  });
  expect(JSON.stringify(entries())).not.toContain('resumeStudio');
  view.rerender(
    <>
      <GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />
      <CookieSettingsButton />
    </>
  );
  expect(pages()).toHaveLength(1);
  route.pathname = '/zh/pricing';
  view.rerender(
    <>
      <GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />
      <CookieSettingsButton />
    </>
  );
  expect(pages()).toHaveLength(2);
  document.cookie = '_ga=example; path=/';
  document.cookie = '_ga_31WBKE6C8Z=example; path=/';
  fireEvent.click(screen.getByRole('button', { name: 'Cookie 设置' }));
  fireEvent.click(screen.getByRole('button', { name: '仅必要 Cookie' }));
  expect((window as any)['ga-disable-G-31WBKE6C8Z']).toBe(true);
  expect(document.cookie).not.toContain('_ga');
  expect(entries()).toContainEqual([
    'consent',
    'update',
    expect.objectContaining({ analytics_storage: 'denied' }),
  ]);
  route.pathname = '/gallery';
  view.rerender(
    <>
      <GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />
      <CookieSettingsButton />
    </>
  );
  expect(pages()).toHaveLength(2);
});
it('ignores malformed or outdated persisted choices', () => {
  for (const raw of [
    'true',
    'analytics',
    '{',
    JSON.stringify({ version: 0, choice: 'analytics' }),
  ]) {
    localStorage.setItem(CONSENT_KEY, raw);
    expect(readAnalyticsConsent(localStorage)).toBeNull();
  }
});
it('drops query, hash, external origin and sensitive dynamic path segments', () => {
  expect(
    sanitizedPage(
      '/studio?resumeStudio=secret&email=private@example.com#photo',
      'https://ink.example'
    )
  ).toEqual({
    page_path: '/studio',
    page_location: 'https://ink.example/studio',
    page_title: 'Tattoo Studio',
    page_referrer: '',
  });
  expect(
    sanitizedPage('/zh/reset-password/secret-token', 'https://ink.example')
      .page_path
  ).toBe('/zh/reset-password');
  expect(
    sanitizedPage('https://evil.example/a?token=x', 'https://ink.example')
      .page_path
  ).toBe('/');
});
it('honors a cross-tab withdrawal immediately', () => {
  render(<GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />);
  fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: CONSENT_KEY,
        newValue: JSON.stringify({ version: 1, choice: 'necessary' }),
      })
    )
  );
  expect((window as any)['ga-disable-G-31WBKE6C8Z']).toBe(true);
});
it('keeps sign-in content available with denied or unavailable preference storage', () => {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ version: 1, choice: 'necessary' })
  );
  const view = render(
    <>
      <GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />
      <input aria-label="Sign-in email" />
    </>
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Sign-in email' }), {
    target: { value: 'person@example.com' },
  });
  expect(
    (screen.getByRole('textbox', { name: 'Sign-in email' }) as HTMLInputElement)
      .value
  ).toBe('person@example.com');
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  view.unmount();
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('Blocked');
  });
  render(<GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />);
  fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }));
  expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
});
it('restores an accepted choice and reuses the loader on reacceptance', () => {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ version: 1, choice: 'analytics' })
  );
  render(
    <>
      <GoogleAnalyticsConsent gaId="G-31WBKE6C8Z" />
      <CookieSettingsButton />
    </>
  );
  expect(
    screen.queryByRole('region', { name: 'Cookie preferences' })
  ).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Only necessary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cookie settings' }));
  fireEvent.click(screen.getByRole('button', { name: 'Accept analytics' }));
  expect(
    document.querySelectorAll('script[src*="googletagmanager"]')
  ).toHaveLength(1);
  expect((window as any)['ga-disable-G-31WBKE6C8Z']).toBe(false);
});
it('preserves only published guide slugs while removing private path tails and query data', () => {
  const cases = [
    [
      '/tattoo-ideas/minimalist?email=private#photo',
      '/tattoo-ideas/minimalist',
    ],
    ['/zh/tattoo-ideas/geometric', '/zh/tattoo-ideas/geometric'],
    ['/en/tattoo-ideas/first-tattoo', '/en/tattoo-ideas/first-tattoo'],
    ['/tattoo-ideas/unknown-private-slug', '/tattoo-ideas'],
    ['/tattoo-ideas/minimalist/private-id', '/tattoo-ideas/minimalist'],
    ['/history/minimalist?resumeStudio=secret', '/history'],
    ['/zh/settings/private-id?email=private', '/zh/settings'],
  ];
  for (const [input, expected] of cases) {
    const result = sanitizedPage(input, 'https://ink.example');
    expect(result.page_path).toBe(expected);
    expect(result.page_location).toBe(`https://ink.example${expected}`);
  }
});
