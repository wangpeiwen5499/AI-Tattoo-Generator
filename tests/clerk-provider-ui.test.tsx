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
import { SocialProviders } from '@/shared/blocks/sign/social-providers';

const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  native: vi.fn(),
  close: vi.fn(),
  toast: vi.fn(),
  loading: vi.fn(),
}));
vi.mock('@/core/auth/client', () => ({
  authClient: { signIn: { oauth2: mocks.oauth } },
  signIn: { social: mocks.native },
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => (messages.sign as any)[key],
}));
vi.mock('@/shared/contexts/app', () => ({
  useAppContext: () => ({ setIsShowSignModal: mocks.close }),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it('uses Clerk for the Google button and sanitizes the post-login destination', async () => {
  mocks.oauth.mockResolvedValue({
    data: { url: 'https://clerk.example.com/oauth/authorize' },
  });
  render(
    <SocialProviders
      configs={{ clerk_google_auth_enabled: 'true' }}
      callbackUrl="https://attacker.example"
      loading={false}
      setLoading={mocks.loading}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() => expect(mocks.close).toHaveBeenCalledWith(false));
  expect(mocks.oauth).toHaveBeenCalledWith({
    providerId: 'clerk',
    callbackURL: '/generate',
    errorCallbackURL: '/sign-in?error=oauth&callbackUrl=%2Fgenerate',
  });
  expect(mocks.native).not.toHaveBeenCalled();
});

it('keeps the dialog open and reports a failed Clerk request', async () => {
  mocks.oauth.mockResolvedValue({ error: { message: 'Provider unavailable' } });
  render(
    <SocialProviders
      configs={{ clerk_google_auth_enabled: 'true' }}
      callbackUrl="/generate"
      loading={false}
      setLoading={mocks.loading}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() =>
    expect(mocks.toast).toHaveBeenCalledWith(messages.sign.social_failed)
  );
  expect(mocks.close).not.toHaveBeenCalled();
});

it('hides Google when no provider has been configured', () => {
  render(
    <SocialProviders
      configs={{}}
      callbackUrl="/generate"
      loading={false}
      setLoading={mocks.loading}
    />
  );
  expect(
    screen.queryByRole('button', { name: 'Sign in with Google' })
  ).toBeNull();
});
