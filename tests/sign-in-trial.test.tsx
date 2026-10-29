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
import { SignInForm } from '@/shared/blocks/sign/sign-in-form';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  close: vi.fn(),
  signin: vi.fn(),
  verified: false,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));
vi.mock('@/core/auth/client', () => ({ signIn: { email: mocks.signin } }));
vi.mock('@/shared/contexts/app', () => ({
  useAppContext: () => ({
    configs: { email_auth_enabled: 'true' },
    setIsShowSignModal: mocks.close,
  }),
}));
vi.mock('@/shared/blocks/sign/social-providers', () => ({
  SocialProviders: () => null,
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => (messages.sign as any)[key],
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.signin.mockImplementation(async (_body, options) =>
    options.onSuccess({ data: { user: { emailVerified: mocks.verified } } })
  );
});
async function login() {
  render(<SignInForm callbackUrl="/generate" />);
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(false));
}
it('closes the login modal and asks unverified members to verify before generating', async () => {
  mocks.verified = false;
  await login();
  expect(mocks.push.mock.calls[0][0]).toBe(
    '/verify-email?email=member%40example.com&callbackUrl=%2Fgenerate'
  );
  expect(mocks.signin.mock.calls[0][0]).not.toHaveProperty('callbackURL');
});
it('closes the login modal and returns verified members to generation', async () => {
  mocks.verified = true;
  await login();
  expect(mocks.push).toHaveBeenCalledWith('/generate');
});
