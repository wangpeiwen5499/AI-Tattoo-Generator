// @vitest-environment jsdom
import React from 'react';
import { loadPhoto } from '@/lib/manual-images';
import { assetImage } from '@/lib/studio-images';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { ManualEditor } from '@/shared/blocks/tattoo/manual-editor';

vi.mock('@/core/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('@/lib/studio-images', () => ({
  assetImage: vi.fn(async () => {
    const image = new Image();
    Object.defineProperties(image, {
      naturalWidth: { value: 900 },
      naturalHeight: { value: 1200 },
    });
    return image;
  }),
  imageBlob: vi.fn(async () => new Blob(['design'], { type: 'image/webp' })),
  photoBlob: vi.fn(async () => new Blob(['photo'], { type: 'image/jpeg' })),
  placementRegion: () => ({ x: 0.2, y: 0.2, width: 0.3, height: 0.4 }),
}));
vi.mock('@/lib/manual-images', () => ({
  loadPhoto: vi.fn(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    return canvas;
  }),
  loadDesign: vi.fn(),
  loadSample: vi.fn(),
  photoCanvas: () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    return canvas;
  },
  canvasBlob: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('creates a design before the photo, reuses its asset, then renders one chosen-resolution try-on', async () => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  let operation = '',
    kind = 'design',
    credits = 3,
    uploadCount = 0;
  const paid: { mode: string | null; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, options?: RequestInit) => {
      const url = new URL(input, 'https://local'),
        mode = url.searchParams.get('mode');
      if (!url.search)
        return Response.json({
          configured: true,
          signedIn: true,
          verified: true,
          credits,
          pending: [],
        });
      if (mode === 'design' || mode === 'render') {
        const body = JSON.parse(options!.body as string);
        operation = body.operationId;
        kind = mode;
        credits -= mode === 'design' ? 1 : 2;
        paid.push({ mode, body });
        return Response.json({ task: `${mode}-task` });
      }
      if (mode === 'status')
        return Response.json({
          state: 'success',
          kind,
          operationId: operation,
        });
      if (mode === 'upload')
        return Response.json({ asset: `upload-${++uploadCount}` });
      if (url.searchParams.has('collection'))
        return Response.json({
          records: [
            {
              id: kind === 'design' ? 'design-record' : 'tryon-record',
              image: kind === 'design' ? 'design-asset' : 'result-asset',
              original: kind === 'render' ? 'photo' : null,
              draft: kind === 'render' ? 'guide' : null,
              operationId: operation,
              prompt: 'fern',
            },
          ],
        });
      throw new Error('Unexpected request');
    })
  );
  render(<ManualEditor locale="en" />);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('Or describe a new design'), {
    target: { value: 'fern' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Generate design · 1 credit' })
  );
  await waitFor(() =>
    expect(
      screen.getByText('Saved to your account · reusable for free')
    ).toBeTruthy()
  );
  fireEvent.change(screen.getByLabelText('Photo file'), {
    target: {
      files: [new File(['photo'], 'photo.png', { type: 'image/png' })],
    },
  });
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Generate real try-on · 1 credit',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  fireEvent.change(screen.getByLabelText('Result resolution'), {
    target: { value: '2K' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Generate real try-on · 2 credits' })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Download AI result' })
    ).toBeTruthy()
  );
  expect(paid).toHaveLength(2);
  expect(paid[1].body).toMatchObject({
    resolution: '2K',
    design: 'design-asset',
    designId: 'design-record',
    photo: 'upload-1',
    guide: 'upload-2',
  });
  expect(paid[1].body.operationId).not.toBe(paid[0].body.operationId);
  expect(uploadCount).toBe(2);
});

it('locks editing while a saved design is still loading', async () => {
  const context = { clearRect: vi.fn(), drawImage: vi.fn() };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D
  );
  let resolveImage: (image: HTMLImageElement) => void = () => {};
  vi.mocked(assetImage).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveImage = resolve;
      })
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) =>
      new URL(input, 'https://local').searchParams.has('collection')
        ? Response.json({
            records: [{ id: 'saved', image: 'asset', prompt: 'rose' }],
          })
        : Response.json({
            configured: true,
            signedIn: true,
            verified: true,
            credits: 3,
            pending: [],
          })
    )
  );
  render(<ManualEditor locale="en" initialDesignId="saved" />);
  await waitFor(() => expect(assetImage).toHaveBeenCalledWith('asset'));
  expect(
    (screen.getByRole('button', { name: 'Upload photo' }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
  const image = new Image();
  Object.defineProperties(image, {
    naturalWidth: { value: 300 },
    naturalHeight: { value: 300 },
  });
  resolveImage(image);
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Upload photo',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
});

it('restores a pending try-on with its own original photo even after choosing a different photo', async () => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  const different = document.createElement('canvas');
  different.width = 300;
  different.height = 300;
  vi.mocked(loadPhoto).mockResolvedValueOnce(different);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = new URL(input, 'https://local');
      if (url.searchParams.has('collection'))
        return Response.json({
          records: [
            {
              id: 'old-result',
              operationId: 'old-op',
              image: 'raw',
              original: 'old-photo',
              draft: 'old-guide',
              designAsset: 'old-design',
              placement: {
                px: 0.3,
                py: 0.4,
                scale: 0.8,
                rotation: 20,
                opacity: 0.7,
                flipped: false,
              },
            },
          ],
        });
      if (url.searchParams.get('mode') === 'status')
        return Response.json({
          state: 'success',
          kind: 'render',
          operationId: 'old-op',
        });
      return Response.json({
        configured: true,
        signedIn: true,
        verified: true,
        credits: 2,
        pending: [{ task: 'old-task', kind: 'render', operationId: 'old-op' }],
      });
    })
  );
  render(<ManualEditor locale="en" />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Resume task' })).toBeTruthy()
  );
  fireEvent.change(screen.getByLabelText('Photo file'), {
    target: { files: [new File(['new'], 'new.png', { type: 'image/png' })] },
  });
  await waitFor(() =>
    expect(
      document.querySelector('section canvas')?.getAttribute('width')
    ).toBe('300')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Resume task' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Download AI result' })
    ).toBeTruthy()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Edit placement' }));
  await waitFor(() =>
    expect(
      document.querySelector('section canvas')?.getAttribute('width')
    ).toBe('900')
  );
});
