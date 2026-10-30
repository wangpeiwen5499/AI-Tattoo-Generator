import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/server/ai/tattoo-scheduler', () => ({
  ensureTattooWorkflow: vi.fn(),
}));

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  validate: vi.fn(),
  start: vi.fn(),
  upload: vi.fn(),
  claimUpload: vi.fn(),
}));
vi.mock('@/shared/models/user', () => ({ getSignUser: mocks.user }));
vi.mock('@/lib/r2', () => ({
  validateUploadedPhoto: mocks.validate,
  getUploadUrl: mocks.upload,
  makeObjectKey: () => 'test-key',
}));
vi.mock('@/server/ai/tattoo-jobs', () => ({
  startTattooGeneration: mocks.start,
  advanceTattooJob: vi.fn(),
  GenerationRequestError: class extends Error {},
}));
vi.mock('@/server/db/guest-queries', () => ({
  claimUpload: mocks.claimUpload,
  getGuestRemaining: () => 3,
}));
vi.mock('next/server', async (original) => ({
  ...(await original<any>()),
  after: vi.fn(),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'old-guest-cookie' }) }),
  headers: async () => new Headers(),
}));
vi.mock('@/shared/models/credit', () => ({ getRemainingCredits: () => 3 }));

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.__minIntervalRateLimitStore?.clear();
});
afterEach(() => vi.unstubAllGlobals());

describe('registration-only trial boundary', () => {
  it('rejects anonymous photo uploads before issuing a storage URL', async () => {
    mocks.user.mockResolvedValue(null);
    const { POST } = await import('@/app/api/upload-url/route');
    const response = await POST(
      new Request('https://local/api/upload-url', {
        method: 'POST',
        body: JSON.stringify({ contentType: 'image/png', contentLength: 10 }),
      })
    );
    expect(response.status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.claimUpload).not.toHaveBeenCalled();
  });

  it('rejects an old guest cookie before reading photos or starting AI', async () => {
    mocks.user.mockResolvedValue(null);
    const { POST } = await import('@/app/api/ai/generate-tattoo/route');
    const response = await POST(
      new Request('https://local/api/ai/generate-tattoo', {
        method: 'POST',
        body: '{}',
      })
    );
    expect(response.status).toBe(401);
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('requires verification before uploading or generating', async () => {
    mocks.user.mockResolvedValue({
      id: 'new-user',
      email: 'test@example.com',
      emailVerified: false,
    });
    const upload = await import('@/app/api/upload-url/route');
    const generation = await import('@/app/api/ai/generate-tattoo/route');
    expect(
      (
        await upload.POST(
          new Request('https://local/api/upload-url', {
            method: 'POST',
            body: '{}',
          })
        )
      ).status
    ).toBe(403);
    expect(
      (
        await generation.POST(
          new Request('https://local/api/ai/generate-tattoo', {
            method: 'POST',
            body: '{}',
          })
        )
      ).status
    ).toBe(403);
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('returns no anonymous credits and identifies signup as the next action', async () => {
    mocks.user.mockResolvedValue(null);
    const { GET } = await import('@/app/api/credits/route');
    const response = await GET();
    expect(await response.json()).toMatchObject({
      credits: 0,
      authenticated: false,
    });
  });
});
