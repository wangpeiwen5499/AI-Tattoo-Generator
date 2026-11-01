// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ManualEditor } from '@/shared/blocks/tattoo/manual-editor';

vi.mock('@/core/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

const sample = vi.hoisted(() => vi.fn());
vi.mock('@/lib/manual-images', () => ({
  loadSample: sample,
  loadPhoto: vi.fn(),
  loadDesign: vi.fn(),
  canvasBlob: vi.fn(),
}));

beforeEach(() => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D
  );
  sample.mockImplementation(async () => {
    const photo = document.createElement('canvas');
    photo.width = 1086;
    photo.height = 1448;
    return {
      photo,
      design: { naturalWidth: 400, naturalHeight: 600 } as HTMLImageElement,
    };
  });
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  sample.mockClear();
});

it('works after unmount/remount, without account, generation or storage calls', async () => {
  const store = vi.spyOn(Storage.prototype, 'setItem');
  const first = render(<ManualEditor locale="en" />);
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Generate real try-on · 1 credit',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  first.unmount();
  render(<ManualEditor locale="en" />);
  expect(
    (
      screen.getByRole('button', {
        name: 'Generate real try-on · 1 credit',
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Generate real try-on · 1 credit',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  expect(sample).toHaveBeenCalledTimes(2);
  expect(
    vi
      .mocked(fetch)
      .mock.calls.every((call) => !call[1]?.method || call[1].method === 'GET')
  ).toBe(true);
  expect(store).not.toHaveBeenCalled();
});
