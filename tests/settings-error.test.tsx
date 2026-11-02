// @vitest-environment jsdom
import React from 'react';
import SettingsError from '@/app/[locale]/(landing)/settings/error';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
afterEach(cleanup);
it('shows a recovery action without exposing server errors', () => {
  const reset = vi.fn();
  render(
    <SettingsError
      error={new Error('private connection string')}
      reset={reset}
    />
  );
  expect(screen.queryByText(/private connection/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(reset).toHaveBeenCalledOnce();
});
