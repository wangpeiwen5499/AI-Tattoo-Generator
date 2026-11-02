import { GET } from '@/app/api/auth/[...all]/route';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), handler: vi.fn() }));
vi.mock('@/core/auth', () => ({ getAuth: mocks.auth }));
vi.mock('better-auth/next-js', () => ({
  toNextJsHandler: () => ({ GET: mocks.handler, POST: mocks.handler }),
}));
vi.mock('@/config', () => ({ envConfigs: { app_url: 'https://example.com' } }));
vi.mock('@/shared/lib/env', () => ({ isCloudflareWorker: false }));
vi.mock('@/shared/lib/rate-limit', () => ({
  enforceMinIntervalRateLimit: () => null,
}));
vi.mock('@/shared/models/config', () => ({ getAllConfigs: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ handler: {} });
});
it('correlates thrown auth failures without exposing error details', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.auth.mockRejectedValue(new Error('private database url'));
  const response = await GET(
    new Request('https://example.com/api/auth/get-session')
  );
  expect(response.status).toBe(503);
  const body = await response.json();
  expect(body.requestId).toBe(response.headers.get('X-Request-Id'));
  expect(JSON.stringify(body)).not.toContain('private');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  log.mockRestore();
});
it('preserves successful sessions and correlates library-generated 500 responses', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.handler.mockResolvedValueOnce(Response.json({ user: { id: 'user' } }));
  expect(
    (await GET(new Request('https://example.com/api/auth/get-session'))).status
  ).toBe(200);
  mocks.handler.mockResolvedValueOnce(new Response(null, { status: 500 }));
  const failed = await GET(
    new Request('https://example.com/api/auth/get-session')
  );
  expect(failed.status).toBe(500);
  expect(failed.headers.get('X-Request-Id')).toBeTruthy();
  log.mockRestore();
});
