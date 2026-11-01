import {
  assertAccountStudio,
  sameOrigin,
  validateStudioInput,
} from '@/server/studio/policy';
import { describe, expect, it, vi } from 'vitest';

describe('production studio boundary', () => {
  it('rejects un-isolated preview before persistence or billing', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(() => assertAccountStudio()).toThrow();
    vi.unstubAllEnvs();
  });
  it('admits an explicitly isolated preview deployment', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    vi.stubEnv('PREVIEW_STUDIO_ISOLATED', '1');
    expect(() => assertAccountStudio()).not.toThrow();
    vi.stubEnv('PREVIEW_STUDIO_ISOLATED', '0');
    expect(() => assertAccountStudio()).toThrow();
    vi.unstubAllEnvs();
  });
  it('requires matching origin on all mutations', () => {
    expect(() =>
      sameOrigin(
        new Request('https://example.com/api/studio', {
          headers: { origin: 'https://evil.com' },
        })
      )
    ).toThrow();
    expect(() =>
      sameOrigin(new Request('https://example.com/api/studio'))
    ).toThrow();
    expect(() =>
      sameOrigin(
        new Request('https://example.com/api/studio', {
          headers: { origin: 'https://example.com' },
        })
      )
    ).not.toThrow();
  });
  it('prices designs at one and renders by resolution, rejecting unowned URL references', () => {
    const operationId = 'd554aaf5-481e-45a8-bd59-72d2e3c5f21c';
    expect(
      validateStudioInput('design', { operationId, prompt: 'rose' }).credits
    ).toBe(1);
    const render = {
      operationId,
      photo: operationId,
      design: operationId,
      guide: operationId,
      region: { x: 0.1, y: 0.1, width: 0.4, height: 0.4 },
      resolution: '4K',
    };
    expect(validateStudioInput('render', render).credits).toBe(3);
    expect(() =>
      validateStudioInput('render', {
        ...render,
        photo: 'https://evil.com/a.png',
      })
    ).toThrow();
    expect(() =>
      validateStudioInput('render', {
        ...render,
        region: { ...render.region, width: 2 },
      })
    ).toThrow();
  });
});
