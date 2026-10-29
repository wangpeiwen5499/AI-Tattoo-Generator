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
import { VerifyEmail } from '@/shared/blocks/sign/verify-email';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
  verify: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  session: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/core/auth/client', () => ({
  authClient: {
    emailOtp: { sendVerificationOtp: mocks.send, verifyEmail: mocks.verify },
    getSession: mocks.session,
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, values?: any) =>
    (messages as any).funnel[key]?.replace('{seconds}', values?.seconds),
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.toast, error: mocks.toast },
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ data: {}, error: null });
  mocks.verify.mockResolvedValue({ data: {}, error: null });
  mocks.session.mockResolvedValue({ data: {} });
});
it('sends a code, prevents immediate resends and returns to the requested page after verification', async () => {
  render(
    <VerifyEmail initialEmail="test@example.com" callbackUrl="/generate" />
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Send verification code' })
  );
  await waitFor(() =>
    expect(mocks.send).toHaveBeenCalledWith({
      email: 'test@example.com',
      type: 'email-verification',
    })
  );
  expect(
    (
      (await screen.findByRole('button', {
        name: 'Resend in 60s',
      })) as HTMLButtonElement
    ).disabled
  ).toBe(true);
  fireEvent.change(screen.getByLabelText('Verification code'), {
    target: { value: '123456' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/generate'));
});
it('does not navigate when the verification code is rejected', async () => {
  mocks.verify.mockResolvedValue({
    error: { message: 'Invalid verification code' },
  });
  render(
    <VerifyEmail
      initialEmail="test@example.com"
      callbackUrl="/generate"
      alreadySent
    />
  );
  fireEvent.change(screen.getByLabelText('Verification code'), {
    target: { value: '000000' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Verify and continue' }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith('Invalid verification code')
  );
  expect(mocks.replace).not.toHaveBeenCalled();
});
