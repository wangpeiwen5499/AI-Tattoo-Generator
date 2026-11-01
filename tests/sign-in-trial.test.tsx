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
  google: false,
  locale: 'en',
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
    configs: {
      email_auth_enabled: 'true',
      google_auth_enabled: mocks.google ? 'true' : 'false',
    },
    setIsShowSignModal: mocks.close,
  }),
}));
vi.mock('@/shared/blocks/sign/social-providers', () => ({
  SocialProviders: () => <button>Google option</button>,
}));
vi.mock('next-intl', () => ({
  useLocale: () => mocks.locale,
  useTranslations: () => (key: string) => (messages.sign as any)[key],
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.google = false;
  mocks.locale = 'en';
  mocks.signin.mockImplementation(async (_body, options) =>
    options.onSuccess({ data: { user: { emailVerified: mocks.verified } } })
  );
});

it('shows Google first and reveals email login only when requested', async () => {
  mocks.google = true;
  render(<SignInForm callbackUrl="/generate" />);
  expect(screen.queryByLabelText('Email')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
  const email = await screen.findByLabelText('Email');
  expect(email).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Google option' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.queryByLabelText('Email')).toBeNull();
  expect(screen.getByRole('button', { name: 'Google option' })).toBeTruthy();
});
async function login() {
  render(<SignInForm callbackUrl="/generate" />);
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.com' },
  });
  fireEvent.change(screen.getByLabelText(/^Password/), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Sign In' }).closest('form')!
  );
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

it('keeps the Studio return destination through email tabs and back', () => {
  mocks.google = true;
  render(<SignInForm callbackUrl="/studio?resumeStudio=1&mode=try-on" />);
  fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Sign Up' }));
  expect(screen.getByLabelText('Confirm password')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  fireEvent.click(screen.getByRole('button', { name: 'Continue with email' }));
  fireEvent.click(screen.getByRole('tab', { name: 'Sign In' }));
  expect(
    screen.getByRole('link', { name: 'Forgot password?' }).getAttribute('href')
  ).toBe(
    '/forgot-password?callbackUrl=%2Fstudio%3FresumeStudio%3D1%26mode%3Dtry-on'
  );
});

it('keeps a localized Studio callback after submitting email sign in', async () => {
  mocks.locale = 'zh';
  mocks.verified = true;
  render(<SignInForm callbackUrl="/studio?resumeStudio=1" />);
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'member@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'Example-password-123!' },
  });
  fireEvent.submit(
    screen.getByRole('button', { name: 'Sign In' }).closest('form')!
  );
  await waitFor(() =>
    expect(mocks.push).toHaveBeenCalledWith('/zh/studio?resumeStudio=1')
  );
});
