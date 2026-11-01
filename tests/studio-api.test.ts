import { DELETE, GET, POST } from '@/app/api/studio/route';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  owner: vi.fn(),
  db: vi.fn(),
  advance: vi.fn(),
  getJob: vi.fn(),
  proxy: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  start: vi.fn(),
}));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/core/db', () => ({ db: mocks.db }));
vi.mock('@/shared/models/user', () => ({ getSignUser: mocks.owner }));
vi.mock('@/shared/models/credit', () => ({ getRemainingCredits: vi.fn() }));
vi.mock('@/server/studio/service', () => ({
  ACTIVE: ['queued', 'running', 'storing'],
  advanceStudioJob: mocks.advance,
  getStudioJob: mocks.getJob,
  removeStudioRecord: mocks.remove,
  startStudioJob: mocks.start,
  studioCollection: vi.fn(),
}));
vi.mock('@/server/studio/assets', () => ({
  proxyAsset: mocks.proxy,
  uploadAsset: mocks.upload,
}));
vi.mock('@/server/studio/scheduler', () => ({ ensureStudioWorkflow: vi.fn() }));
const headers = {
  origin: 'https://example.com',
  'content-type': 'application/json',
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VERCEL_ENV', 'production');
  mocks.owner.mockResolvedValue({ id: 'owner', emailVerified: true });
});
afterEach(() => vi.unstubAllEnvs());
it('preview capability probe never reads live session/database and mutations reject', async () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const res = await GET(new Request('https://example.com/api/studio'));
  expect(await res.json()).toMatchObject({
    mode: 'account',
    configured: false,
    signedIn: false,
    credits: 0,
  });
  const write = await POST(
    new Request('https://example.com/api/studio?mode=design', {
      method: 'POST',
      headers,
      body: '{}',
    })
  );
  expect(write.status).toBe(503);
  expect(mocks.owner).not.toHaveBeenCalled();
  expect(mocks.db).not.toHaveBeenCalled();
  expect(mocks.start).not.toHaveBeenCalled();
});
it('all foreign-origin mutations reject before auth/provider/storage', async () => {
  for (const method of [POST, DELETE]) {
    const res = await method(
      new Request('https://example.com/api/studio?mode=upload', {
        method: 'POST',
        headers: { origin: 'https://evil.com' },
      })
    );
    expect(res.status).toBe(403);
  }
  expect(mocks.owner).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it('signed-out upload and asset access return 401', async () => {
  mocks.owner.mockResolvedValue(null);
  expect(
    (
      await POST(
        new Request('https://example.com/api/studio?mode=upload', {
          method: 'POST',
          headers,
        })
      )
    ).status
  ).toBe(401);
  expect(
    (await GET(new Request('https://example.com/api/studio?asset=secret')))
      .status
  ).toBe(401);
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.proxy).not.toHaveBeenCalled();
});
it('foreign job cannot trigger advancement', async () => {
  const { StudioError } = await import('@/server/studio/policy');
  mocks.getJob.mockRejectedValue(new StudioError('Job not found', 404));
  const res = await POST(
    new Request('https://example.com/api/studio?mode=status', {
      method: 'POST',
      headers,
      body: JSON.stringify({ task: 'foreign' }),
    })
  );
  expect(res.status).toBe(404);
  expect(mocks.advance).not.toHaveBeenCalled();
});
it('bounds actual JSON stream before parsing or billing', async () => {
  const res = await POST(
    new Request('https://example.com/api/studio?mode=design', {
      method: 'POST',
      headers,
      body: 'x'.repeat(17000),
    })
  );
  expect(res.status).toBe(413);
  expect(mocks.start).not.toHaveBeenCalled();
});
it('unverified uploads and design saves reject before reading image or storage', async () => {
  mocks.owner.mockResolvedValue({ id: 'owner', emailVerified: false });
  for (const mode of ['upload', 'save-design']) {
    const res = await POST(
      new Request(`https://example.com/api/studio?mode=${mode}`, {
        method: 'POST',
        headers,
      })
    );
    expect(res.status).toBe(403);
  }
  expect(mocks.upload).not.toHaveBeenCalled();
});
