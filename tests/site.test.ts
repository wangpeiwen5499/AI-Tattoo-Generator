import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/middleware', () => ({
  default: () => () => new Response(null),
}));
vi.mock('better-auth/cookies', () => ({
  getSessionCookie: () => 'test-session',
}));

describe('public metadata and private caching', () => {
  it('builds the sitemap from the configured domain and includes real product pages', async () => {
    const sitemap = (await import('@/app/sitemap')).default;
    const entries = sitemap();
    expect(entries.some((entry) => entry.url.endsWith('/generate'))).toBe(false);
    expect(entries.some((entry) => entry.url.endsWith('/pricing'))).toBe(true);
    expect(
      entries.some(
        (entry) =>
          entry.url.includes('your-domain') || entry.url.endsWith('/history')
      )
    ).toBe(false);
  });

  it('does not mark either language of history as publicly cacheable', async () => {
    const { proxy } = await import('@/proxy');
    for (const path of [
      '/history',
      '/history/123',
      '/zh/history',
      '/zh/settings/profile',
      '/sign-in',
    ]) {
      const response = await proxy({
        nextUrl: new URL(`https://local${path}`),
        url: `https://local${path}`,
      } as any);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(response.headers.get('cache-control')).not.toContain('public');
    }
  });
});
