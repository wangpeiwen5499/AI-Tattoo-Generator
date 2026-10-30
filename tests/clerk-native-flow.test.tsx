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
import { NativeGoogleController } from '@/shared/blocks/sign/clerk-google-controller';
import { ClerkGoogleFlow } from '@/shared/blocks/sign/clerk-google-flow';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  token: vi.fn(),
  fetch: vi.fn(),
  signOut: vi.fn(),
  session: null as { id: string } | null,
  tasks: vi.fn(),
  authSession: { currentTask: null } as {
    currentTask: { key: string } | null;
  } | null,
  loaded: true,
  failed: false,
  provider: vi.fn(),
}));
vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children, ...props }: any) => {
    mocks.provider(props);
    return children;
  },
  ClerkLoaded: ({ children }: any) => (mocks.loaded ? children : null),
  ClerkLoading: () => null,
  ClerkFailed: ({ children }: any) => (mocks.failed ? children : null),
  HandleSSOCallback: () => null,
  RedirectToTasks: (props: unknown) => {
    mocks.tasks(props);
    return null;
  },
  SignIn: () => null,
  SignUp: () => null,
  // A retained needs_identifier attempt makes the newer sso API resolve without navigating.
  useSignIn: () => ({ signIn: { sso: async () => ({ error: null }) } }),
  useClerk: () => ({ session: mocks.session, signOut: mocks.signOut }),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, getToken: mocks.token }),
  useSession: () => ({ isLoaded: true, session: mocks.authSession }),
}));
vi.mock('@clerk/react/legacy', () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: { authenticateWithRedirect: mocks.redirect },
  }),
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
  mocks.authSession = { currentTask: null };
  mocks.loaded = true;
  mocks.failed = false;
});

it('preloads core Clerk without starting login and preserves a click queued before SDK readiness', async () => {
  mocks.loaded = false;
  mocks.redirect.mockResolvedValue({ error: null });
  const onFailure = vi.fn();
  const view = render(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested={false}
      destination="/history"
      locale="en"
      onFailure={onFailure}
    />
  );
  expect(mocks.provider).toHaveBeenLastCalledWith(
    expect.objectContaining({ prefetchUI: false })
  );
  expect(mocks.redirect).not.toHaveBeenCalled();
  view.rerender(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested
      destination="/history"
      locale="en"
      onFailure={onFailure}
    />
  );
  expect(mocks.redirect).not.toHaveBeenCalled();
  mocks.loaded = true;
  view.rerender(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested
      destination="/history"
      locale="en"
      onFailure={onFailure}
    />
  );
  await waitFor(() => expect(mocks.redirect).toHaveBeenCalledOnce());
  expect(mocks.redirect.mock.calls[0][0].redirectUrlComplete).toBe(
    '/auth/google/tasks?callbackUrl=%2Fhistory'
  );
});

it('reports a failed SDK load only after a login attempt', async () => {
  mocks.loaded = false;
  mocks.failed = true;
  const onFailure = vi.fn();
  const view = render(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested={false}
      destination="/"
      locale="en"
      onFailure={onFailure}
    />
  );
  expect(onFailure).not.toHaveBeenCalled();
  view.rerender(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested
      destination="/"
      locale="en"
      onFailure={onFailure}
    />
  );
  await waitFor(() => expect(onFailure).toHaveBeenCalledOnce());
});

it('lets the parent retry inline after a failed Google SSO attempt', async () => {
  mocks.redirect
    .mockRejectedValueOnce(new Error('OAuth failed'))
    .mockResolvedValue({ error: null });
  const onFailure = vi.fn();
  const view = render(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested
      destination="/"
      locale="en"
      onFailure={onFailure}
    />
  );
  await waitFor(() => expect(onFailure).toHaveBeenCalledOnce());
  view.rerender(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested={false}
      destination="/"
      locale="en"
      onFailure={onFailure}
    />
  );
  view.rerender(
    <NativeGoogleController
      publishableKey="pk_test_example"
      requested
      destination="/"
      locale="en"
      onFailure={onFailure}
    />
  );
  await waitFor(() => expect(mocks.redirect).toHaveBeenCalledTimes(2));
  expect(onFailure).toHaveBeenCalledOnce();
});

it('starts a fresh Google attempt even when Clerk retains an unfinished sign-in', async () => {
  mocks.redirect.mockResolvedValue({ error: null });
  render(
    <ClerkGoogleFlow
      publishableKey="pk_test_example"
      step="start"
      callbackUrl="https://attacker.example"
    />
  );
  await waitFor(() => expect(mocks.redirect).toHaveBeenCalledOnce());
  expect(mocks.redirect).toHaveBeenCalledWith({
    strategy: 'oauth_google',
    oidcPrompt: 'select_account',
    redirectUrl: '/auth/google/callback?callbackUrl=%2Fgenerate',
    redirectUrlComplete: '/auth/google/tasks?callbackUrl=%2Fgenerate',
  });
  expect(screen.queryByText('Connecting to Google…')).toBeNull();
  expect(screen.queryByRole('link', { name: 'Back to sign in' })).toBeNull();
});

it('supports another Google account selection after website logout leaves a Clerk session', async () => {
  mocks.redirect.mockResolvedValue({ error: null });
  const first = render(
    <ClerkGoogleFlow publishableKey="pk_test_example" step="start" />
  );
  await waitFor(() => expect(mocks.redirect).toHaveBeenCalledOnce());
  first.unmount();
  mocks.session = { id: 'previous-clerk-session' };
  mocks.signOut.mockImplementation(async (callback: () => void) => {
    mocks.session = null;
    callback();
  });
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="start" />);
  await waitFor(() => expect(mocks.redirect).toHaveBeenCalledTimes(2));
  expect(mocks.signOut).toHaveBeenCalledWith(expect.any(Function), {
    sessionId: 'previous-clerk-session',
  });
  expect(mocks.signOut.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.redirect.mock.invocationCallOrder[1]
  );
  expect(mocks.redirect.mock.calls[1][0].oidcPrompt).toBe('select_account');
});

it('routes real pending session requirements through Clerk tasks before completing website login', () => {
  mocks.authSession = { currentTask: { key: 'choose-organization' } };
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="tasks" />);
  expect(mocks.tasks).toHaveBeenCalledWith({
    redirectUrl: '/auth/google/complete?callbackUrl=%2Fgenerate',
  });
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it('completes website login directly on the tasks URL when no task is pending', async () => {
  mocks.token.mockResolvedValue('test-session-token');
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ code: 'ACCOUNT_LINK_REQUIRED' }), {
      status: 403,
    })
  );
  vi.stubGlobal('fetch', mocks.fetch);
  render(
    <ClerkGoogleFlow
      publishableKey="pk_test_example"
      step="tasks"
      callbackUrl="/"
    />
  );
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  expect(mocks.tasks).not.toHaveBeenCalled();
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    messages.sign.google_link_required
  );
});

it('continues automatically when a pending Clerk task is completed', async () => {
  mocks.authSession = { currentTask: { key: 'choose-organization' } };
  mocks.token.mockResolvedValue('test-session-token');
  mocks.fetch.mockResolvedValue(
    new Response(JSON.stringify({ code: 'ACCOUNT_LINK_REQUIRED' }), {
      status: 403,
    })
  );
  vi.stubGlobal('fetch', mocks.fetch);
  const view = render(
    <ClerkGoogleFlow publishableKey="pk_test_example" step="tasks" />
  );
  expect(mocks.fetch).not.toHaveBeenCalled();
  mocks.authSession = { currentTask: null };
  view.rerender(
    <ClerkGoogleFlow publishableKey="pk_test_example" step="tasks" />
  );
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
});

it('shows a retry when Clerk cannot start Google', async () => {
  mocks.redirect.mockRejectedValue(new Error('Cancelled'));
  render(<ClerkGoogleFlow publishableKey="pk_test_example" step="start" />);
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    messages.sign.social_failed
  );
  fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
  await waitFor(() => expect(mocks.redirect).toHaveBeenCalledTimes(2));
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
