// @vitest-environment jsdom
import { useGeneration } from '@/hooks/use-generation';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

for (const savedState of ['completed', 'unavailable']) {
  it(`discovers an active job even when storage contains a ${savedState} project`, async () => {
    sessionStorage.setItem('tattoo-active-project', 'old-project');
    const active = {
      projectId: 'active-project',
      resolution: '4K',
      creditsCost: 3,
      createdAt: new Date().toISOString(),
      status: 'processing',
      stage: 'design',
      completedParts: 0,
      refunded: false,
      tattooDesignUrl: null,
      images: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('old-project'))
          return savedState === 'completed'
            ? Response.json({
                ...active,
                projectId: 'old-project',
                status: 'completed',
                tattooDesignUrl: 'https://storage.example/old.png',
              })
            : Response.json({ error: 'Not found' }, { status: 404 });
        return Response.json(active);
      })
    );
    const { result } = renderHook(() => useGeneration());
    await waitFor(() => expect(result.current.status).toBe('generating'));
    expect(result.current.resolution).toBe('4K');
    expect(result.current.creditsCost).toBe(3);
    expect(sessionStorage.getItem('tattoo-active-project')).toBe(
      'active-project'
    );
  });
}
