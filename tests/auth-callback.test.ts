import { expect, it } from 'vitest';

it('keeps local callback paths and rejects external or encoded redirects', async () => {
  const { safeAuthCallback } = await import('@/shared/lib/auth-callback');
  expect(safeAuthCallback('/pricing?from=credits', 'en')).toBe(
    '/pricing?from=credits'
  );
  expect(safeAuthCallback('/generate', 'zh')).toBe('/zh/generate');
  for (const path of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/%2f%2fevil.example',
  ]) {
    expect(safeAuthCallback(path, 'en')).toBe('/generate');
  }
});
