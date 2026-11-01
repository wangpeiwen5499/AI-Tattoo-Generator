// @vitest-environment jsdom
import React from 'react';
import { defaultPlacement } from '@/lib/manual-placement';
import {
  readLoginDraft,
  removeLoginDraft,
  saveLoginDraft,
  studioLoginUrl,
} from '@/lib/studio-login-draft';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { toast } from 'sonner';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { ManualEditor } from '@/shared/blocks/tattoo/manual-editor';

const state = vi.hoisted(() => ({
  signedIn: true,
  generate: vi.fn(),
  render: vi.fn(),
}));
vi.mock('@/hooks/use-studio', () => ({
  useStudio: () => ({
    capabilities: {
      configured: true,
      signedIn: state.signedIn,
      verified: true,
      credits: 3,
    },
    busy: false,
    pending: null,
    error: '',
    gate: null,
    result: null,
    generate: state.generate,
    render: state.render,
  }),
}));
vi.mock('@/lib/studio-login-draft', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/studio-login-draft')>()),
  readLoginDraft: vi.fn(),
  removeLoginDraft: vi.fn(),
  saveLoginDraft: vi.fn(),
}));
vi.mock('@/lib/manual-images', () => ({
  loadPhoto: vi.fn(async () => {
    const c = document.createElement('canvas');
    c.width = 720;
    c.height = 960;
    return c;
  }),
  loadDesign: vi.fn(async () => ({ naturalWidth: 400, naturalHeight: 600 })),
  canvasBlob: vi.fn(async () => new Blob(['photo'], { type: 'image/png' })),
  photoCanvas: vi.fn(() => document.createElement('canvas')),
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.signedIn = true;
  window.history.replaceState(null, '', '/studio?resumeStudio=handoff');
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.mocked(readLoginDraft).mockResolvedValue({
    photo: new Blob(['photo'], { type: 'image/png' }),
    design: new Blob(['design'], { type: 'image/png' }),
    placement: {
      ...defaultPlacement(),
      px: 0.32,
      py: 0.42,
      rotation: 35,
      opacity: 0.6,
      flipped: true,
    },
    prompt: 'my fern',
    resolution: '4K',
    action: 'render',
    expires: Date.now() + 10000,
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

it('restores both images, placement, prompt and resolution at step four without charging', async () => {
  render(<ManualEditor locale="en" />);
  await waitFor(() => expect(removeLoginDraft).toHaveBeenCalledWith('handoff'));
  expect(
    (screen.getByLabelText('Or describe a new design') as HTMLTextAreaElement)
      .value
  ).toBe('my fern');
  expect(
    (screen.getByLabelText('Result resolution') as HTMLSelectElement).value
  ).toBe('4K');
  expect(
    document.querySelector('[aria-current="step"]')?.textContent
  ).toContain('Real result');
  expect(document.querySelector('section canvas')?.getAttribute('width')).toBe(
    '720'
  );
  expect(screen.getByText('Selected design')).toBeTruthy();
  expect(state.generate).not.toHaveBeenCalled();
  expect(state.render).not.toHaveBeenCalled();
  expect(window.location.search).toBe('');
  fireEvent.click(
    screen.getByRole('button', { name: 'Generate real try-on · 3 credits' })
  );
  expect(state.render).toHaveBeenCalledOnce();
});
it('keeps the editor in place when temporary storage fails before login', async () => {
  state.signedIn = false;
  window.history.replaceState(null, '', '/studio');
  vi.mocked(saveLoginDraft).mockRejectedValueOnce(new Error('quota'));
  render(<ManualEditor locale="en" />);
  fireEvent.change(screen.getByLabelText('Photo file'), {
    target: { files: [new File(['p'], 'p.png', { type: 'image/png' })] },
  });
  await waitFor(() =>
    expect(
      document.querySelector('section canvas')?.getAttribute('width')
    ).toBe('720')
  );
  fireEvent.change(screen.getByLabelText('Design file'), {
    target: { files: [new File(['d'], 'd.png', { type: 'image/png' })] },
  });
  await waitFor(() => expect(screen.getByText('Selected design')).toBeTruthy());
  fireEvent.click(
    screen.getByRole('button', { name: 'Generate real try-on · 1 credit' })
  );
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(saveLoginDraft).toHaveBeenCalledWith(
    expect.objectContaining({
      action: 'render',
      photo: expect.any(Blob),
      design: expect.any(Blob),
    })
  );
  expect(state.render).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe('/studio');
  expect(document.querySelector('section canvas')?.getAttribute('width')).toBe(
    '720'
  );
});
it('does not silently start over or charge when a return draft has expired', async () => {
  vi.mocked(readLoginDraft).mockResolvedValueOnce(null);
  render(<ManualEditor locale="en" />);
  await waitFor(() =>
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('expired'))
  );
  expect(state.render).not.toHaveBeenCalled();
  expect(state.generate).not.toHaveBeenCalled();
});
it('uses the same local callback for email and Google login, preserving Chinese locale', () => {
  const u = new URL(studioLoginUrl('zh', 'tab-token'), 'https://tattoovis.ink');
  expect(u.pathname).toBe('/zh/sign-in');
  expect(u.searchParams.get('callbackUrl')).toBe(
    '/zh/studio?resumeStudio=tab-token'
  );
});
