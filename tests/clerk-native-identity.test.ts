import { afterEach, expect, it, vi } from 'vitest';

import { getClerkNativeConfig } from '@/core/auth/clerk';
import { verifyClerkIdentity } from '@/core/auth/clerk-identity';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  user: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@clerk/backend', () => ({
  createClerkClient: (options: unknown) => {
    mocks.create(options);
    return {
      authenticateRequest: mocks.authenticate,
      users: { getUser: mocks.user },
    };
  },
}));
afterEach(() => vi.clearAllMocks());
const config = {
  publishableKey: `pk_test_${Buffer.from('clerk.example.test$').toString('base64')}`,
  secretKey: 'sk_test_example',
};
const request = () =>
  new Request('https://tattoovis.ink/api/auth/clerk/sign-in', {
    method: 'POST',
    headers: {
      authorization: 'Bearer test-session-token',
      origin: 'https://tattoovis.ink',
    },
  });
function signedIn() {
  mocks.authenticate.mockResolvedValue({
    isAuthenticated: true,
    toAuth: () => ({
      isAuthenticated: true,
      userId: 'user_123',
      sessionId: 'sess_123',
    }),
  });
  mocks.user.mockResolvedValue({
    id: 'user_123',
    primaryEmailAddressId: 'email_123',
    emailAddresses: [
      {
        id: 'email_123',
        emailAddress: 'member@example.com',
        verification: { status: 'verified' },
      },
    ],
    externalAccounts: [{ provider: 'oauth_google' }],
    firstName: 'Google',
    lastName: 'Member',
    imageUrl: 'https://example.com/avatar.png',
  });
}

it('enables native Google only with native API keys, never with old OAuth client credentials', () => {
  expect(
    getClerkNativeConfig({
      CLERK_OAUTH_CLIENT_ID: 'old-client',
      CLERK_OAUTH_CLIENT_SECRET: 'old-secret',
    })
  ).toBeNull();
  expect(
    getClerkNativeConfig({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: config.publishableKey,
      CLERK_SECRET_KEY: config.secretKey,
    })
  ).toEqual(config);
});
it('authenticates a session with the configured instance and allowed origin before loading the verified profile', async () => {
  signedIn();
  expect(
    await verifyClerkIdentity(request(), config, 'https://tattoovis.ink')
  ).toMatchObject({
    id: 'user_123',
    email: 'member@example.com',
    name: 'Google Member',
  });
  expect(mocks.create).toHaveBeenCalledWith(config);
  expect(mocks.authenticate).toHaveBeenCalledWith(expect.any(Request), {
    authorizedParties: ['https://tattoovis.ink'],
    acceptsToken: 'session_token',
    issuer: 'https://clerk.example.test',
  });
  expect(mocks.user).toHaveBeenCalledWith('user_123');
});
it('rejects invalid sessions before reading any profile', async () => {
  mocks.authenticate.mockResolvedValue({ isAuthenticated: false });
  await expect(
    verifyClerkIdentity(request(), config, 'https://tattoovis.ink')
  ).rejects.toThrow();
  expect(mocks.user).not.toHaveBeenCalled();
});
it('rejects unverified email and missing Google linkage', async () => {
  signedIn();
  const user = await mocks.user();
  mocks.user.mockResolvedValue({
    ...user,
    emailAddresses: [
      {
        id: 'email_123',
        emailAddress: 'member@example.com',
        verification: { status: 'unverified' },
      },
    ],
  });
  await expect(
    verifyClerkIdentity(request(), config, 'https://tattoovis.ink')
  ).rejects.toThrow();
  mocks.user.mockResolvedValue({ ...user, externalAccounts: [] });
  await expect(
    verifyClerkIdentity(request(), config, 'https://tattoovis.ink')
  ).rejects.toThrow();
});
it('requires a bearer token and never accepts a cookie alone', async () => {
  await expect(
    verifyClerkIdentity(
      new Request('https://tattoovis.ink/api/auth/clerk/sign-in'),
      config,
      'https://tattoovis.ink'
    )
  ).rejects.toThrow();
  expect(mocks.authenticate).not.toHaveBeenCalled();
});
