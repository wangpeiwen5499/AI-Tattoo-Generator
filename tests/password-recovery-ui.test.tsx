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

import messages from '@/config/locale/messages/en/common.json';
import { PasswordRecovery } from '@/shared/blocks/sign/password-recovery';

const mocks = vi.hoisted(() => ({ request: vi.fn(), reset: vi.fn() }));
vi.mock('@/core/auth/client', () => ({
  authClient: {
    requestPasswordReset: mocks.request,
    resetPassword: mocks.reset,
  },
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => (messages.sign as any)[key],
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
beforeEach(() => {
  mocks.request.mockResolvedValue({ data: { status: true } });
  mocks.reset.mockResolvedValue({ data: { status: true } });
});

it('requests a reset with a local return path and shows a neutral confirmation with resend cooldown', async () => {
  render(
    <PasswordRecovery mode="request" callbackUrl="https://attacker.example" />
  );
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.com' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
  await screen.findByRole('status');
  expect(mocks.request).toHaveBeenCalledWith({
    email: 'member@example.com',
    redirectTo: `${window.location.origin}/reset-password?callbackUrl=%2Fstudio`,
  });
  expect(
    (screen.getByRole('button', { name: '60s' }) as HTMLButtonElement).disabled
  ).toBe(true);
});

it('prevents a mismatched reset and submits a matching password with its token', async () => {
  render(<PasswordRecovery mode="reset" token="test-reset-token" />);
  fireEvent.change(screen.getByLabelText('New password'), {
    target: { value: 'New-password-123!' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'Different-password!' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'Passwords do not match.'
  );
  expect(mocks.reset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'New-password-123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  await waitFor(() =>
    expect(mocks.reset).toHaveBeenCalledWith({
      token: 'test-reset-token',
      newPassword: 'New-password-123!',
    })
  );
  expect(await screen.findByRole('status')).toHaveProperty(
    'textContent',
    messages.sign.reset_success
  );
});

it('offers a fresh link when the reset URL is invalid', () => {
  render(<PasswordRecovery mode="reset" invalid />);
  expect(screen.getByRole('alert').textContent).toBe(
    messages.sign.reset_invalid
  );
  expect(screen.queryByLabelText('New password')).toBeNull();
  expect(
    screen.getByRole('link', { name: 'Send reset link' }).getAttribute('href')
  ).toContain('/forgot-password');
});
