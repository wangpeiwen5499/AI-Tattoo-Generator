// @vitest-environment jsdom
import { useStudio } from '@/hooks/use-studio';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('recovers an accepted account task after leaving, without another paid start', async () => {
  let operationId = '',
    pending: object[] = [],
    complete = false,
    credits = 3;
  const start = vi.fn();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options?: RequestInit) => {
      const url = new URL(input, 'https://local');
      const mode = url.searchParams.get('mode');
      if (!url.search)
        return Response.json({
          configured: true,
          signedIn: true,
          verified: true,
          credits,
          pending,
        });
      if (url.searchParams.has('collection'))
        return Response.json({
          records: [
            { id: 'design', image: 'asset', prompt: 'fern', operationId },
          ],
        });
      if (mode === 'design') {
        start();
        operationId = JSON.parse(options!.body as string).operationId;
        credits--;
        pending = [{ task: 'accepted', kind: 'design', operationId }];
        return Response.json({ task: 'accepted' });
      }
      if (mode === 'status') {
        if (complete) pending = [];
        return Response.json({
          state: complete ? 'success' : 'running',
          kind: 'design',
          operationId,
        });
      }
      throw new Error('Unexpected API');
    })
  );
  const first = renderHook(() => useStudio());
  await waitFor(() =>
    expect(first.result.current.capabilities?.credits).toBe(3)
  );
  act(() => first.result.current.generate('fern'));
  await waitFor(() => expect(first.result.current.task?.task).toBe('accepted'));
  first.unmount();
  complete = true;
  const second = renderHook(() => useStudio());
  await waitFor(() =>
    expect(second.result.current.pending?.task).toBe('accepted')
  );
  act(() => second.result.current.resume());
  await waitFor(() =>
    expect(second.result.current.result?.record.id).toBe('design')
  );
  expect(start).toHaveBeenCalledTimes(1);
  expect(second.result.current.capabilities?.credits).toBe(2);
});
it('routes an insufficient balance to pricing before any generation request', async () => {
  const fetcher = vi.fn(async () =>
    Response.json({
      configured: true,
      signedIn: true,
      verified: true,
      credits: 0,
      pending: [],
    })
  );
  vi.stubGlobal('fetch', fetcher);
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.capabilities).not.toBeNull());
  act(() => result.current.generate('rose'));
  expect(result.current.gate).toBe(402);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
