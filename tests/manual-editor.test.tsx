// @vitest-environment jsdom
import React from 'react';
import { loadDesign, loadPhoto } from '@/lib/manual-images';
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

it('returns to the design step if a placed design is removed after revisiting placement', async () => {
  render(<ManualEditor locale="en" />);
  fireEvent.click(screen.getAllByRole('button', { name: /^Choose design/ })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  await waitFor(() =>
    expect(document.querySelector('section canvas')).toBeTruthy()
  );
  fireEvent.click(
    screen.getAllByRole('button', { name: /^Confirm placement/ })[0]
  );
  fireEvent.keyDown(document.querySelector('section canvas')!, {
    key: 'Delete',
  });
  expect(
    document.querySelector('[aria-current="step"]')?.textContent
  ).toContain('Choose design');
});

it('works after unmount/remount, without account, generation or storage calls', async () => {
  const store = vi.spyOn(Storage.prototype, 'setItem');
  const first = render(<ManualEditor locale="en" />);
  fireEvent.click(screen.getAllByRole('button', { name: /^Choose design/ })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Generate real try-on · 1 credit',
          hidden: true,
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
        hidden: true,
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.click(screen.getAllByRole('button', { name: /^Choose design/ })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Generate real try-on · 1 credit',
          hidden: true,
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

it('keeps the uploaded body photo when trying a sample design', async () => {
  const photo = document.createElement('canvas');
  photo.width = 720;
  photo.height = 960;
  vi.mocked(loadPhoto).mockResolvedValueOnce(photo);
  render(<ManualEditor locale="en" />);
  fireEvent.change(screen.getByLabelText('Photo file'), {
    target: { files: [new File(['photo'], 'body.png', { type: 'image/png' })] },
  });
  await waitFor(() =>
    expect(
      document.querySelector('section canvas')?.getAttribute('width')
    ).toBe('720')
  );
  fireEvent.click(screen.getAllByRole('button', { name: /^Choose design/ })[0]);
  fireEvent.click(screen.getByRole('button', { name: 'Try sample' }));
  await waitFor(() => expect(screen.getByText('Selected design')).toBeTruthy());
  expect(document.querySelector('section canvas')?.getAttribute('width')).toBe(
    '720'
  );
  expect(document.querySelector('section canvas')?.getAttribute('height')).toBe(
    '960'
  );
  expect(screen.queryByRole('button', { name: 'Try sample' })).toBeNull();
});

it('does not offer a sample that would replace an uploaded design', async () => {
  vi.mocked(loadDesign).mockResolvedValueOnce({
    naturalWidth: 400,
    naturalHeight: 600,
  } as HTMLImageElement);
  render(<ManualEditor locale="en" />);
  fireEvent.change(screen.getByLabelText('Design file'), {
    target: {
      files: [new File(['design'], 'design.png', { type: 'image/png' })],
    },
  });
  await waitFor(() => expect(screen.getByText('Selected design')).toBeTruthy());
  expect(screen.queryByRole('button', { name: 'Try sample' })).toBeNull();
  expect(sample).not.toHaveBeenCalled();
});
