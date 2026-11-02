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

import { LocalStudioDraft } from '@/shared/blocks/tattoo/local-studio-draft';

const storage = vi.hoisted(() => ({
  saveLoginDraft: vi.fn(),
  readLoginDraft: vi.fn(),
  removeLoginDraft: vi.fn(),
}));
vi.mock('@/lib/studio-login-draft', () => storage);

const key = 'tattoovis-local-studio-draft';
const draft = {
  prompt: 'rose',
  photo: null,
  design: null,
  placement: {},
  resolution: '1K',
  action: 'design',
  expires: Date.now() + 10000,
} as any;
beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  storage.readLoginDraft.mockResolvedValue(draft);
  storage.saveLoginDraft.mockResolvedValue('new-token');
  storage.removeLoginDraft.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
function setup() {
  const capture = vi.fn().mockResolvedValue(draft);
  const restore = vi.fn().mockResolvedValue(undefined);
  const view = render(
    <LocalStudioDraft
      locale="en"
      disabled={false}
      hasContent
      capture={capture}
      restore={restore}
      snapshotKey="one"
    />
  );
  return { capture, restore, view };
}
it('saves only on request with seven-day retention and replaces the previous draft', async () => {
  localStorage.setItem(key, 'old-token');
  const { capture } = setup();
  await screen.findByRole('button', { name: 'Replace local draft' });
  expect(capture).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Replace local draft' }));
  await waitFor(() =>
    expect(storage.saveLoginDraft).toHaveBeenCalledWith(draft, 604800000)
  );
  await waitFor(() =>
    expect(storage.removeLoginDraft).toHaveBeenCalledWith('old-token')
  );
  expect(localStorage.getItem(key)).toBe('new-token');
});
it('restores and deletes the saved local draft explicitly', async () => {
  localStorage.setItem(key, 'old-token');
  const { restore } = setup();
  await screen.findByRole('button', { name: 'Replace local draft' });
  fireEvent.click(screen.getByRole('button', { name: 'Restore draft' }));
  await waitFor(() => expect(restore).toHaveBeenCalledWith(draft));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('restored')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  expect(storage.removeLoginDraft).toHaveBeenCalledWith('old-token');
});
it('removes stale tokens and reports storage errors without capturing work automatically', async () => {
  localStorage.setItem(key, 'stale');
  storage.readLoginDraft.mockResolvedValue(null);
  const { capture } = setup();
  await waitFor(() => expect(localStorage.getItem(key)).toBeNull());
  storage.saveLoginDraft.mockRejectedValue(new Error('quota'));
  fireEvent.click(screen.getByRole('button', { name: 'Save local draft' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain(
      'Local draft action failed'
    )
  );
  expect(capture).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem(key)).toBeNull();
});
it('does not overwrite a draft saved by another tab during capture', async () => {
  const { capture } = setup();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Save local draft',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  capture.mockImplementation(async () => {
    localStorage.setItem(key, 'other-tab');
    return draft;
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save local draft' }));
  await waitFor(() =>
    expect(storage.removeLoginDraft).toHaveBeenCalledWith('new-token')
  );
  expect(localStorage.getItem(key)).toBe('other-tab');
});

it('cleans up a new blob draft if browser token storage fails', async () => {
  setup();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Save local draft',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
  );
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('storage disabled');
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save local draft' }));
  await waitFor(() =>
    expect(storage.removeLoginDraft).toHaveBeenCalledWith('new-token')
  );
  expect(screen.getByRole('status').textContent).toContain(
    'Local draft action failed'
  );
  expect(localStorage.getItem(key)).toBeNull();
});
