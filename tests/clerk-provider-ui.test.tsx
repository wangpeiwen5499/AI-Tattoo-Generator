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
  push: vi.fn(),
  controller: vi.fn(),
}));
vi.mock('next/dynamic', () => ({
  default: () => (props: unknown) => {
    mocks.controller(props);
    return null;
  },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
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

it('opens the native Google flow with a safe destination instead of requesting Clerk OAuth consent', async () => {
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
  expect(mocks.push).toHaveBeenCalledWith(
    '/auth/google?callbackUrl=%2Fgenerate'
  );
  expect(mocks.oauth).not.toHaveBeenCalled();
  expect(mocks.native).not.toHaveBeenCalled();
});

it('preserves a local post-login destination when entering the native flow', async () => {
  render(
    <SocialProviders
      configs={{ clerk_google_auth_enabled: 'true' }}
      callbackUrl="/history"
      loading={false}
      setLoading={mocks.loading}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  expect(mocks.push).toHaveBeenCalledWith(
    '/auth/google?callbackUrl=%2Fhistory'
  );
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

it('warms Clerk on the login screen and starts inline without opening the intermediate route', () => {
  render(
    <SocialProviders
      configs={{
        clerk_google_auth_enabled: 'true',
        clerk_publishable_key: 'pk_test_example',
      }}
      callbackUrl="/history"
      loading={false}
      setLoading={mocks.loading}
    />
  );
  expect(mocks.controller).toHaveBeenLastCalledWith(
    expect.objectContaining({ requested: false, destination: '/history' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  expect(mocks.controller).toHaveBeenLastCalledWith(
    expect.objectContaining({ requested: true, destination: '/history' })
  );
  expect(mocks.push).not.toHaveBeenCalled();
  expect(mocks.close).not.toHaveBeenCalled();
  expect(mocks.loading).toHaveBeenCalledWith(true);
});
