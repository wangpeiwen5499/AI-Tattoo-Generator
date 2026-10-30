import { expect, it } from 'vitest';

import { getClerkOAuthConfig } from '@/core/auth/clerk';

it('keeps Clerk disabled until all three OAuth settings are available', () => {
  expect(getClerkOAuthConfig({})).toBeNull();
  expect(getClerkOAuthConfig({ CLERK_OAUTH_CLIENT_ID: 'test-id' })).toBeNull();
});

it('enables PKCE and maps only boolean verified claims from Clerk', async () => {
  const config = getClerkOAuthConfig({
    CLERK_OAUTH_CLIENT_ID: 'test-id',
    CLERK_OAUTH_CLIENT_SECRET: 'test-secret',
    CLERK_OAUTH_DISCOVERY_URL:
      'https://auth.example.com/.well-known/openid-configuration',
  })!;
  expect(config.providerId).toBe('clerk');
  expect(config.pkce).toBe(true);
  expect(config.scopes).toEqual(['openid', 'email', 'profile']);
  expect(
    await config.mapProfileToUser!({
      sub: 'user_123',
      email: 'member@example.com',
      email_verified: true,
    })
  ).toMatchObject({ emailVerified: true });
  expect(
    await config.mapProfileToUser!({
      sub: 'user_123',
      email: 'member@example.com',
      email_verified: 'false',
    })
  ).toMatchObject({ emailVerified: false });
});

it('rejects insecure discovery URLs', () => {
  expect(
    getClerkOAuthConfig({
      CLERK_OAUTH_CLIENT_ID: 'test-id',
      CLERK_OAUTH_CLIENT_SECRET: 'test-secret',
      CLERK_OAUTH_DISCOVERY_URL: 'http://auth.example.com/discovery',
    })
  ).toBeNull();
});
