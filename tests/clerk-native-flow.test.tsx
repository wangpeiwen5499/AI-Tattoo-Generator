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
import { ClerkGoogleFlow } from '@/shared/blocks/sign/clerk-google-flow';

const mocks = vi.hoisted(() => ({
  sso: vi.fn(),
  token: vi.fn(),
  fetch: vi.fn(),
  signOut: vi.fn(),
  session: null as { id: string } | null,
  tasks: vi.fn(),
}));
vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children }: any) => children,
  ClerkLoaded: ({ children }: any) => children,
  ClerkLoading: () => null,
  ClerkFailed: () => null,
  HandleSSOCallback: () => null,
  RedirectToTasks: (props: unknown) => {
    mocks.tasks(props);
    return null;
  },
  SignIn: () => null,
  SignUp: () => null,
  useSignIn: () => ({ signIn: { sso: mocks.sso } }),
  useClerk: () => ({ session: mocks.session, signOut: mocks.signOut }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mocks.token }),
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
  vi.unstubAllGlobals();
  mocks.session = null;
});

it('starts Google directly with account selection and local SDK callback paths', async () => {
  mocks.sso.mockResolvedValue({ error: null });
  render(
    <ClerkGoogleFlow
      publishableKey="pk_test_example"
      step="start"
      callbackUrl="https://attacker.example"
    />
  );
  await waitFor(() => expect(mocks.sso).toHaveBeenCalledOnce());
  expect(mocks.sso).toHaveBeenCalledWith({
    strategy: 'oauth_google',
    oidcPrompt: 'select_account',
    redirectCallbackUrl: '/auth/google/callback?callbackUrl=%2Fgenerate',
    redirectUrl: '/auth/google/tasks?callbackUrl=%2Fgenerate',
  });
});

it('supports another Google account selection after website logout leaves a Clerk session', async () => {
  mocks.sso.mockResolvedValue({ error: null });
  const first = render(
    <ClerkGoogleFlow publishableKey="pk_test_example" step="start" />
  );
  await waitFor(() => expect(mocks.sso).toHaveBeenCalledOnce());
  first.unmount();
  mocks.session = { id: 'previous-clerk-session' };
  mocks.signOut.mockImplementation(async (callback: () => void) => {
    mocks.session = null;
    callback();
  });
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="start" />);
  await waitFor(() => expect(mocks.sso).toHaveBeenCalledTimes(2));
  expect(mocks.signOut).toHaveBeenCalledWith(expect.any(Function), {
    sessionId: 'previous-clerk-session',
  });
  expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.sso.mock.invocationCallOrder[1]
  );
  expect(mocks.sso.mock.calls[1][0].oidcPrompt).toBe('select_account');
});

it('routes session requirements through Clerk tasks before completing website login', () => {
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="tasks" />);
  expect(mocks.tasks).toHaveBeenCalledWith({
    redirectUrl: '/auth/google/complete?callbackUrl=%2Fgenerate',
  });
});

it('shows a retry when Clerk cannot start Google', async () => {
  mocks.sso.mockResolvedValue({ error: { message: 'Cancelled' } });
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="start" />);
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    messages.sign.social_failed
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() => expect(mocks.sso).toHaveBeenCalledTimes(2));
});

it('submits only the Clerk session token and handles an existing account that needs verification', async () => {
  mocks.token.mockResolvedValue('test-session-token');
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ code: 'ACCOUNT_LINK_REQUIRED' }), {
      status: 403,
    })
  );
  vi.stubGlobal('fetch', mocks.fetch);
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="complete" />);
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    messages.sign.google_link_required
  );
  expect(mocks.fetch).toHaveBeenCalledWith(
    '/api/auth/clerk/sign-in',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer test-session-token',
      },
      body: '{}',
    })
  );
});
