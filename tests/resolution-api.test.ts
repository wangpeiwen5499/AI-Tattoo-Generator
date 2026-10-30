import { POST } from '@/app/api/ai/generate-tattoo/route';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ start: vi.fn(), validate: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/server/auth/generation-access', () => ({
  requireGenerationUser: async () => ({ user: { id: 'member' } }),
}));
vi.mock('@/shared/lib/rate-limit', () => ({
  enforceMinIntervalRateLimit: () => null,
}));
vi.mock('@/lib/r2', () => ({ validateUploadedPhoto: mocks.validate }));
vi.mock('@/server/ai/tattoo-jobs', () => ({
  startTattooGeneration: mocks.start,
  advanceTattooJob: vi.fn(),
  GenerationRequestError: class extends Error {
    status = 400;
  },
}));
afterEach(() => vi.clearAllMocks());
const request = (body: unknown) =>
  new Request('https://tattoovis.ink/api/ai/generate-tattoo', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
it('passes only the validated resolution, never a client-provided credit quote, to the service', async () => {
  mocks.start.mockResolvedValue('project');
  const response = await POST(
    request({
      bodyPhotoKey: 'uploads/member/photo.png',
      prompt: 'Wolf',
      resolution: '4K',
      creditsCost: 1,
    })
  );
  expect(response.status).toBe(200);
  expect(mocks.start).toHaveBeenCalledWith(
    expect.objectContaining({ resolution: '4K' })
  );
  expect(mocks.start.mock.calls[0][0]).not.toHaveProperty('creditsCost');
});
it('defaults an old client request to 1K', async () => {
  mocks.start.mockResolvedValue('legacy');
  expect(
    (
      await POST(
        request({ bodyPhotoKey: 'uploads/member/photo.png', prompt: 'Wolf' })
      )
    ).status
  ).toBe(200);
  expect(mocks.start).toHaveBeenCalledWith(
    expect.objectContaining({ resolution: '1K' })
  );
});
it('rejects unsupported resolutions before photo validation or billing', async () => {
  for (const resolution of ['8K', '4k', null, 4])
    expect(
      (
        await POST(
          request({
            bodyPhotoKey: 'uploads/member/photo.png',
            prompt: 'Wolf',
            resolution,
          })
        )
      ).status
    ).toBe(400);
  expect(mocks.start).not.toHaveBeenCalled();
  expect(mocks.validate).not.toHaveBeenCalled();
});
