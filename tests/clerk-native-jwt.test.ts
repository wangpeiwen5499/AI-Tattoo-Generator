import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { verifyClerkIdentity } from '@/core/auth/clerk-identity';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'native-clerk-test-key',
  use: 'sig',
  alg: 'RS256',
};
const config = {
  publishableKey: `pk_test_${Buffer.from('clerk.example.test$').toString('base64')}`,
  secretKey: 'sk_test_fixture_not_a_real_key',
};
function token(claims: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: jwk.kid })
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: 'https://clerk.example.test',
      azp: 'https://tattoovis.ink',
      sub: 'user_jwt_fixture',
      sid: 'sess_jwt_fixture',
      v: 2,
      sts: 'active',
      iat: now - 5,
      nbf: now - 5,
      exp: now + 60,
      ...claims,
    })
  ).toString('base64url');
  const message = `${header}.${payload}`;
  return `${message}.${sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url')}`;
}
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url.includes('/jwks')) return Response.json({ keys: [jwk] });
  if (url.includes('/users/user_jwt_fixture'))
    return Response.json({
      object: 'user',
      id: 'user_jwt_fixture',
      primary_email_address_id: 'email_fixture',
      first_name: 'Verified',
      last_name: 'Member',
      image_url: '',
      email_addresses: [
        {
          object: 'email_address',
          id: 'email_fixture',
          email_address: 'verified@example.com',
          linked_to: [],
          verification: { status: 'verified', strategy: 'from_oauth_google' },
        },
      ],
      external_accounts: [
        {
          object: 'google_account',
          id: 'external_fixture',
          provider: 'oauth_google',
          verification: { status: 'verified' },
        },
      ],
    });
  throw new Error('Unexpected outbound request in JWT test');
});
beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

function request(jwt: string) {
  return new Request('https://tattoovis.ink/api/auth/clerk/sign-in', {
    method: 'POST',
    headers: {
      origin: 'https://tattoovis.ink',
      authorization: `Bearer ${jwt}`,
    },
  });
}
it('uses the real Clerk SDK to verify an RSA signed token against the configured instance JWKS', async () => {
  expect(
    await verifyClerkIdentity(request(token()), config, 'https://tattoovis.ink')
  ).toMatchObject({ id: 'user_jwt_fixture', email: 'verified@example.com' });
});

it('authenticates even after the website endpoint has parsed the request body', async () => {
  const incoming = new Request('https://tattoovis.ink/api/auth/clerk/sign-in', {
    method: 'POST',
    headers: {
      origin: 'https://tattoovis.ink',
      authorization: `Bearer ${token()}`,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  await incoming.json();
  expect(
    await verifyClerkIdentity(incoming, config, 'https://tattoovis.ink')
  ).toMatchObject({ email: 'verified@example.com' });
});
it.each([
  ['expired', { exp: Math.floor(Date.now() / 1000) - 60 }],
  ['wrong issuer', { iss: 'https://other-clerk.example.test' }],
  ['wrong authorized party', { azp: 'https://attacker.example' }],
  ['pending session', { sts: 'pending' }],
])('rejects %s sessions before profile access', async (_label, claims) => {
  await expect(
    verifyClerkIdentity(request(token(claims)), config, 'https://tattoovis.ink')
  ).rejects.toThrow();
  expect(
    fetchMock.mock.calls.some(([input]) => String(input).includes('/users/'))
  ).toBe(false);
});
it('rejects an invalid signature before profile access', async () => {
  const parts = token().split('.');
  parts[2] = Buffer.alloc(256).toString('base64url');
  await expect(
    verifyClerkIdentity(
      request(parts.join('.')),
      config,
      'https://tattoovis.ink'
    )
  ).rejects.toThrow();
});
