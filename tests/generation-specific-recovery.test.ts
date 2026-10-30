// @vitest-environment jsdom
import { useGeneration } from '@/hooks/use-generation';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});
it('resumes the selected history project instead of a different active project', async () => {
  const fetch = vi.fn(async (url: string) =>
    Response.json({
      projectId: url.includes('wanted') ? 'wanted' : 'other',
      createdAt: new Date().toISOString(),
      status: 'processing',
      stage: 'fusion',
      completedParts: 1,
      refunded: false,
      images: [
        {
          bodyPart: 'left-arm',
          status: 'completed',
          url: 'https://files.example/arm.png',
        },
      ],
      tattooDesignUrl: 'https://files.example/design.png',
      resolution: '2K',
      creditsCost: 2,
    })
  );
  vi.stubGlobal('fetch', fetch);
  const { result } = renderHook(() => useGeneration('wanted'));
  await waitFor(() => expect(result.current.status).toBe('generating'));
  expect(fetch.mock.calls[0][0]).toContain('id=wanted');
  expect(result.current.result?.images[0].url).toContain('arm.png');
});
