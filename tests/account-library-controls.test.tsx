// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import {
  DeleteRecordButton,
  LocalDate,
  RenameRecordButton,
} from '@/shared/blocks/tattoo/account-library-pages';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('requires a separate confirmation and allows cancel without deleting', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(
    <DeleteRecordButton
      collection="designs"
      id="one"
      label="Delete"
      confirmLabel="Confirm"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
it('persists the edited record name and refreshes the collection', async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetcher);
  render(<RenameRecordButton collection="designs" id="one" name="Rose" />);
  fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Lotus' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      '/api/studio',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          collection: 'designs',
          id: 'one',
          name: 'Lotus',
        }),
      })
    )
  );
});
it('renders a semantic local time with a stable ISO datetime', () => {
  const { container } = render(<LocalDate value="2026-01-01T12:00:00.000Z" />);
  expect(container.querySelector('time')?.dateTime).toBe(
    '2026-01-01T12:00:00.000Z'
  );
});

it('keeps failed delete confirmation open and clears the error when reopened', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue('offline'));
  render(
    <DeleteRecordButton
      collection="history"
      id="one"
      label="Delete"
      confirmLabel="Confirm"
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(
    screen.getByRole('dialog', { name: 'Delete this record?' })
  ).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() =>
    expect(screen.getByRole('alert').textContent).toContain('Could not delete')
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(screen.queryByRole('alert')).toBeNull();
});
