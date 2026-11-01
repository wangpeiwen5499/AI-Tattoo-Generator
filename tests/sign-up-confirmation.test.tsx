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

import messages from '@/config/locale/messages/en/common.json';
import { SignUp } from '@/shared/blocks/sign/sign-up';

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  push: vi.fn(),
  toast: vi.fn(),
}));
vi.mock('@/core/auth/client', () => ({ signUp: { email: mocks.signup } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string) =>
    namespace === 'common.sign'
      ? (messages.sign as any)[key]
      : (messages.funnel as any)[key],
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));
vi.mock('@/shared/blocks/sign/social-providers', () => ({
  SocialProviders: () => null,
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toast, success: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('hides disabled email registration when Clerk is the only enabled provider', () => {
  render(
    <SignUp
      configs={{
        email_auth_enabled: 'false',
        google_auth_enabled: 'true',
      }}
      callbackUrl="/generate"
    />
  );
  expect(screen.queryByLabelText('Email')).toBeNull();
});

it('blocks mismatched passwords and submits only after both values match', async () => {
  render(<SignUp configs={{}} callbackUrl="/generate" />);
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'New member' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'different' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
  expect(mocks.signup).not.toHaveBeenCalled();
  expect(mocks.toast).toHaveBeenCalledWith('Passwords do not match.');
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }));
  await waitFor(() => expect(mocks.signup).toHaveBeenCalledOnce());
  expect(mocks.signup.mock.calls[0][0]).not.toHaveProperty('confirmPassword');
});

it('preserves the Studio draft callback when signup requires verification', async () => {
  mocks.signup.mockImplementationOnce(async (_body, options) =>
    options.onSuccess({})
  );
  render(<SignUp configs={{}} callbackUrl="/studio?resumeStudio=1" />);
  fireEvent.change(screen.getByLabelText('Name'), {
    target: { value: 'New member' },
  });
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'new@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.change(screen.getByLabelText('Confirm password'), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Sign Up' }).closest('form')!
  );
  await waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith(
      '/verify-email?email=new%40example.com&callbackUrl=%2Fstudio%3FresumeStudio%3D1&sent=1'
    )
  );
});
