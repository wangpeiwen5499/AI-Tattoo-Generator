import {
  authorizeLab,
  buildPlacementPrompt,
  labAvailable,
  readLabAsset,
  signLabAsset,
} from '@/server/ai/try-on-lab';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllEnvs());
it('disables lab API on Production even with valid test keys', () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  vi.stubEnv('KIE_LAB_API_KEY', 'test-key');
  vi.stubEnv('KIE_LAB_ACCESS_TOKEN', 'a'.repeat(32));
  expect(labAvailable()).toBe(false);
  expect(
    authorizeLab(
      new Request('https://local', {
        headers: { authorization: `Bearer ${'a'.repeat(32)}` },
      })
    )
  ).toBe(false);
});
it('requires separate lab credentials and the access token on Preview', () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('KIE_LAB_API_KEY', '');
  vi.stubEnv('KIE_API_KEY', 'production-must-not-be-used');
  vi.stubEnv('KIE_LAB_ACCESS_TOKEN', 'a'.repeat(32));
  expect(labAvailable()).toBe(false);
  vi.stubEnv('KIE_LAB_API_KEY', 'test-key');
  expect(labAvailable()).toBe(true);
  expect(authorizeLab(new Request('https://local'))).toBe(false);
  expect(
    authorizeLab(
      new Request('https://local', {
        headers: { authorization: `Bearer ${'a'.repeat(32)}` },
      })
    )
  ).toBe(true);
});
it('rejects tampered, expired and arbitrary-origin asset tokens', () => {
  vi.stubEnv('KIE_LAB_ACCESS_TOKEN', 'a'.repeat(32));
  const token = signLabAsset(
    'https://tempfile.redpandaai.co/lab/photo.png',
    Date.now() + 1000
  );
  expect(readLabAsset(token)).toContain('/lab/photo.png');
  expect(() => readLabAsset(token + 'x')).toThrow();
  expect(() =>
    readLabAsset(
      signLabAsset('https://tempfile.redpandaai.co/lab/photo.png', 1)
    )
  ).toThrow();
  expect(() => signLabAsset('http://127.0.0.1/private')).toThrow();
  expect(() => signLabAsset('https://evil.example/photo.png')).toThrow();
});
it('anchors rendering to the uploaded view and selected area rather than fixed body parts', () => {
  const prompt = buildPlacementPrompt({
    x: 0.3,
    y: 0.2,
    width: 0.2,
    height: 0.3,
  });
  expect(prompt).toContain('30%');
  expect(prompt).toContain('original camera angle');
  expect(prompt).toContain('Do not invent');
  expect(prompt).not.toContain('calf');
});
