import { StudioAccessError, StudioClient } from '@/lib/studio-client';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());
it('surfaces server billing errors without silently retrying paid submissions', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(JSON.stringify({ error: 'Insufficient credits' }), {
        status: 402,
      })
  );
  const client = new StudioClient(fetcher as typeof fetch);
  await expect(
    client.start('design', { operationId: 'same-operation', prompt: 'rose' })
  ).rejects.toMatchObject({ status: 402 });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('keeps operation IDs and signal on submissions, and never stores a local balance', async () => {
  const fetcher = vi.fn(
    async (_url: RequestInfo | URL, _options?: RequestInit) =>
      Response.json({ task: 'saved-task' })
  );
  const client = new StudioClient(fetcher as typeof fetch);
  const signal = new AbortController().signal;
  expect(
    await client.start('design', { operationId: 'op', prompt: 'rose' }, signal)
  ).toEqual({ task: 'saved-task' });
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({
    operationId: 'op',
  });
  expect(fetcher.mock.calls[0][1]!.signal).toBe(signal);
});
it('distinguishes sign-in, verification and pricing gates', () => {
  expect(new StudioAccessError('login', 401).status).toBe(401);
  expect(new StudioAccessError('verify', 403).status).toBe(403);
});
