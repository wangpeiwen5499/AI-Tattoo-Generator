// @vitest-environment jsdom
import { useGeneration } from '@/hooks/use-generation';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
it('submits the selected resolution, restores its server quote, and preserves it for another design', async () => {
  const starts: any[] = [];
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      upload = {};
      status = 200;
      onload?: () => void;
      open() {}
      setRequestHeader() {}
      send() {
        queueMicrotask(() => this.onload?.());
      }
    }
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/upload-url')
        return Response.json({
          key: 'uploads/member/photo.png',
          publicUrl: 'https://storage.example/photo.png',
          uploadUrl: 'https://storage.example/put',
        });
      if (url === '/api/ai/generate-tattoo') {
        starts.push(JSON.parse(String(init?.body)));
        return Response.json({ projectId: 'project' });
      }
      if (url.includes('status?id='))
        return Response.json({
          projectId: 'project',
          createdAt: new Date().toISOString(),
          status: 'completed',
          stage: 'completed',
          completedParts: 4,
          resolution: '4K',
          creditsCost: 3,
          tattooDesignUrl: 'https://storage.example/design.png',
          images: [],
          refunded: false,
        });
      return new Response(null, { status: 204 });
    })
  );
  const { result } = renderHook(() => useGeneration());
  await act(async () => {
    await result.current.uploadPhoto(
      new File(['photo'], 'photo.png', { type: 'image/png' })
    );
  });
  act(() => {
    result.current.setPrompt('Wolf');
    result.current.setResolution('4K');
  });
  await act(async () => {
    await result.current.generate();
  });
  expect(starts).toHaveLength(1);
  expect(starts[0].resolution).toBe('4K');
  expect(starts[0]).not.toHaveProperty('creditsCost');
  expect(result.current.result?.resolution).toBe('4K');
  expect(result.current.creditsCost).toBe(3);
  act(() => result.current.resetPrompt());
  expect(result.current.resolution).toBe('4K');
  expect(result.current.status).toBe('ready');
});
