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
import { SocialProviders } from '@/shared/blocks/sign/social-providers';

const mocks = vi.hoisted(() => ({
  social: vi.fn(),
  close: vi.fn(),
  toast: vi.fn(),
  loading: vi.fn(),
  controller: vi.fn(),
}));
vi.mock('next/dynamic', () => ({
  default: () => (props: unknown) => {
    mocks.controller(props);
    return null;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/core/auth/client', () => ({ signIn: { social: mocks.social } }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => (messages.sign as any)[key],
}));
vi.mock('@/shared/contexts/app', () => ({
  useAppContext: () => ({ setIsShowSignModal: mocks.close }),
}));
vi.mock('sonner', () => ({ toast: { error: mocks.toast } }));
beforeEach(() => mocks.social.mockResolvedValue({ error: null }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function mount(
  callbackUrl = '/history',
  configs: Record<string, string> = {
    google_auth_enabled: 'true',
    clerk_google_auth_enabled: 'true',
    clerk_publishable_key: 'pk_test_old',
  }
) {
  render(
    <SocialProviders
      configs={configs}
      callbackUrl={callbackUrl}
      loading={false}
      setLoading={mocks.loading}
    />
  );
}
it('uses direct Google even when legacy Clerk settings remain, without preloading Clerk', async () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() =>
    expect(mocks.social).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        callbackURL: '/history',
        errorCallbackURL: '/sign-in?callbackUrl=%2Fhistory',
      })
    )
  );
  expect(mocks.controller).not.toHaveBeenCalled();
});
it('sanitizes the destination before sending it to the auth server', async () => {
  mount('https://attacker.example');
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() =>
    expect(mocks.social).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google', callbackURL: '/generate' })
    )
  );
});
it('does not expose Clerk as a fallback when direct Google is unavailable', () => {
  mount('/', { clerk_google_auth_enabled: 'true' });
  expect(
    screen.queryByRole('button', { name: 'Sign in with Google' })
  ).toBeNull();
});
it('keeps the form usable and displays an error when the auth request fails', async () => {
  mocks.social.mockRejectedValueOnce(new Error('Network error'));
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  expect(mocks.loading).toHaveBeenLastCalledWith(false);
  expect(mocks.close).not.toHaveBeenCalled();
});
