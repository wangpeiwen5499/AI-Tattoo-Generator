// @vitest-environment jsdom
import React from 'react';
import { useStudio } from '@/hooks/use-studio';
import { StudioClient } from '@/lib/studio-client';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('recovers transient read failures without retrying mutations', async () => {
  let reads = 0;
  const fetcher = vi.fn(async (_url: unknown, init?: RequestInit) => {
    if (init?.method === 'POST')
      return Response.json({ error: 'unavailable' }, { status: 503 });
    return ++reads === 1
      ? Response.json({ error: 'unavailable' }, { status: 503 })
      : Response.json({ records: [] });
  });
  const client = new StudioClient(fetcher as typeof fetch);
  await expect(client.collection('designs')).resolves.toEqual({ records: [] });
  await expect(client.start('design', {})).rejects.toMatchObject({
    status: 503,
  });
  expect(fetcher).toHaveBeenCalledTimes(3);
});
it('does not turn unknown account capabilities into a login gate', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {}))
  );
  const { result } = renderHook(() => useStudio());
  act(() => {
    expect(result.current.access()).toBe(false);
  });
  await waitFor(() => expect(result.current.gate).toBe(503));
});
it('stops retrying when a read is aborted', async () => {
  const controller = new AbortController();
  const fetcher = vi.fn(async () => {
    controller.abort();
    return Response.json({}, { status: 503 });
  });
  await expect(
    new StudioClient(fetcher as typeof fetch).capabilities(controller.signal)
  ).rejects.toBeDefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it('keeps submission failures visible after refreshing the balance', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: RequestInit) =>
      init?.method === 'POST'
        ? Response.json({ error: 'Verify email first' }, { status: 403 })
        : Response.json({
            configured: true,
            signedIn: true,
            verified: true,
            credits: 3,
            pending: [],
          })
    )
  );
  const { result } = renderHook(() => useStudio());
  await waitFor(() => expect(result.current.capabilities?.signedIn).toBe(true));
  act(() => result.current.generate('fern'));
  await waitFor(() => expect(result.current.busy).toBe(false));
  expect(result.current.error).toBe('Verify email first');
  expect(result.current.gate).toBe(403);
});
