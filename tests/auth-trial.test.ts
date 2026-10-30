import { betterAuth } from 'better-auth';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { getAuthOptions } from '@/core/auth/config';
import { createAuthDatabase } from '@/core/auth/trial-adapter';
import * as schema from '@/config/db/schema';
import * as creditModel from '@/shared/models/credit';
import { getRemainingCredits } from '@/shared/models/credit';

import { createTestDatabase } from './database';

const state = vi.hoisted(() => ({
  database: null as any,
  mail: [] as Array<{ to: string; code: string; text?: string }>,
}));
vi.mock('@/core/db', () => ({ db: () => state.database }));
vi.mock('@/shared/models/user', () => ({
  appendUserToResult: (x: unknown) => x,
}));
vi.mock('@/shared/models/config', () => ({ getAllConfigs: () => ({}) }));
vi.mock('@/shared/services/rbac', () => ({ grantRoleForNewUser: vi.fn() }));
vi.mock('@/shared/lib/ip', () => ({ getClientIp: async () => '127.0.0.1' }));
vi.mock('@/shared/blocks/email/verification-code', () => ({
  VerificationCode: (props: unknown) => props,
}));
vi.mock('@/shared/services/email', () => ({
  getEmailService: () => ({
    getProvider: () => ({}),
    sendEmail: async (mail: any) => {
      state.mail.push({ to: mail.to, code: mail.react?.code, text: mail.text });
      return { success: true };
    },
  }),
}));

let close: (() => Promise<void>) | undefined;
beforeAll(async () => {
  const test = await createTestDatabase();
  state.database = test.database;
  close = () => test.client.close();
});
afterAll(async () => close?.());

it('sends a real OTP through the mocked mail adapter, verifies the account and never repeats its signup gift', async () => {
  const options = await getAuthOptions({
    resend_api_key: 'test-only',
    resend_sender_email: 'test@example.com',
  });
  const auth = betterAuth({
    ...options,
    baseURL: 'http://localhost:3000',
    secret: 'local-test-only-secret-not-for-production-12345',
    database: createAuthDatabase(state.database, 'pg'),
    rateLimit: { enabled: false },
  });
  const headers = new Headers({
    origin: 'http://localhost:3000',
    'x-forwarded-for': '127.0.0.1',
  });
  const email = 'trial@example.com';
  const password = 'Example-password-123!';
  const signup = await auth.api.signUpEmail({
    body: { email, password, name: 'Trial user' },
    headers,
    asResponse: true,
  });
  expect(signup.status).toBe(200);
  const account = (await signup.json()).user;
  expect(account.emailVerified).toBe(false);
  expect(await getRemainingCredits(account.id)).toBe(3);
  expect(state.mail).toHaveLength(1);
  expect(state.mail[0].code).toMatch(/^\d{6}$/);
  const invalid = await auth.handler(
    new Request('http://localhost:3000/api/auth/email-otp/verify-email', {
      method: 'POST',
      headers: {
        ...Object.fromEntries(headers),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, otp: 'invalid' }),
    })
  );
  expect(invalid.status).toBe(400);
  const verified = await auth.handler(
    new Request('http://localhost:3000/api/auth/email-otp/verify-email', {
      method: 'POST',
      headers: {
        ...Object.fromEntries(headers),
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, otp: state.mail[0].code }),
    })
  );
  expect(verified.status).toBe(200);
  const verifiedData = await verified.json();
  expect(verifiedData.user.emailVerified).toBe(true);
  expect(verifiedData.token).toBeTruthy();
  const login = await auth.api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  expect(login.status).toBe(200);
  expect(await getRemainingCredits(account.id)).toBe(3);
  expect(
    await state.database
      .select()
      .from(schema.credit)
      .where(eq(schema.credit.userId, account.id))
  ).toHaveLength(1);
});

it('rolls back a newly created user when their signup gift fails, allowing a clean retry', async () => {
  const options = await getAuthOptions({
    resend_api_key: 'test-only',
    resend_sender_email: 'test@example.com',
  });
  const auth = betterAuth({
    ...options,
    baseURL: 'http://localhost:3000',
    secret: 'local-test-only-secret-not-for-production-12345',
    database: createAuthDatabase(state.database, 'pg'),
    rateLimit: { enabled: false },
  });
  const gift = vi
    .spyOn(creditModel, 'grantCreditsForNewUser')
    .mockRejectedValueOnce(new Error('Simulated credit write failure'));
  const args = {
    body: {
      email: 'retry@example.com',
      password: 'Example-password-123!',
      name: 'Retry user',
    },
    headers: new Headers({ origin: 'http://localhost:3000' }),
    asResponse: true as const,
  };
  const failed = await auth.api.signUpEmail(args);
  expect(failed.ok).toBe(false);
  expect(
    await state.database
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, 'retry@example.com'))
  ).toHaveLength(0);
  gift.mockRestore();
  const retry = await auth.api.signUpEmail(args);
  expect(retry.status).toBe(200);
  expect(await getRemainingCredits((await retry.json()).user.id)).toBe(3);
});

it('uses the trusted Cloudflare IP for signup quota even when forwarded IP changes', async () => {
  const options = await getAuthOptions({});
  for (let i = 0; i < 10; i++)
    await options.databaseHooks.user.create.before(
      { id: 'quota-test' },
      {
        headers: new Headers({
          'cf-connecting-ip': '198.51.100.9',
          'x-forwarded-for': 'spoof-' + i,
        }),
      }
    );
  await expect(
    options.databaseHooks.user.create.before(
      { id: 'quota-test' },
      {
        headers: new Headers({
          'cf-connecting-ip': '198.51.100.9',
          'x-forwarded-for': 'another-spoof',
        }),
      }
    )
  ).rejects.toThrow('Daily account creation limit');
});

it('recovers a password with a single-use token, revokes sessions and preserves credits', async () => {
  const options = await getAuthOptions({
    resend_api_key: 'test-only',
    resend_sender_email: 'test@example.com',
  });
  const auth = betterAuth({
    ...options,
    baseURL: 'http://localhost:3000',
    secret: 'local-test-only-secret-not-for-production-12345',
    database: createAuthDatabase(state.database, 'pg'),
    rateLimit: { enabled: false },
  });
  const headers = new Headers({ origin: 'http://localhost:3000' });
  const email = 'recover@example.com';
  const password = 'Old-password-123!';
  const signup = await auth.api.signUpEmail({
    body: { email, password, name: 'Recovery user' },
    headers,
    asResponse: true,
  });
  const signupData = await signup.json();
  const userId = signupData.user.id;
  const sessionHeaders = new Headers();
  sessionHeaders.set(
    'cookie',
    signup.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ')
  );
  expect(await auth.api.getSession({ headers: sessionHeaders })).toBeTruthy();
  const beforeUnknown = state.mail.length;
  const unknown = await auth.api.requestPasswordReset({
    body: {
      email: 'not-a-member@example.com',
      redirectTo: 'http://localhost:3000/reset-password',
    },
    headers,
    asResponse: true,
  });
  const requested = await auth.api.requestPasswordReset({
    body: { email, redirectTo: 'http://localhost:3000/reset-password' },
    headers,
    asResponse: true,
  });
  expect(unknown.status).toBe(200);
  expect(requested.status).toBe(200);
  expect(await unknown.json()).toEqual(await requested.json());
  expect(state.mail.length).toBe(beforeUnknown + 1);
  const resetLink = state.mail.at(-1)?.text?.match(/https?:\/\/\S+/)?.[0];
  expect(resetLink).toBeTruthy();
  const token = new URL(resetLink!).pathname.split('/').at(-1)!;
  const newPassword = 'New-password-456!';
  const reset = await auth.api.resetPassword({
    body: { token, newPassword },
    headers,
    asResponse: true,
  });
  expect(reset.status).toBe(200);
  expect(
    await auth.api.getSession({
      headers: sessionHeaders,
      query: { disableCookieCache: true },
    })
  ).toBeNull();
  const replay = await auth.api.resetPassword({
    body: { token, newPassword },
    headers,
    asResponse: true,
  });
  expect(replay.ok).toBe(false);
  const oldLogin = await auth.api.signInEmail({
    body: { email, password },
    headers,
    asResponse: true,
  });
  expect(oldLogin.ok).toBe(false);
  const newLogin = await auth.api.signInEmail({
    body: { email, password: newPassword },
    headers,
    asResponse: true,
  });
  expect(newLogin.status).toBe(200);
  expect(await getRemainingCredits(userId)).toBe(3);
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: 'http://localhost:3000/reset-password' },
    headers,
  });
  const expiredLink = state.mail.at(-1)!.text!.match(/https?:\/\/\S+/)![0];
  const expiredToken = new URL(expiredLink).pathname.split('/').at(-1)!;
  await state.database
    .update(schema.verification)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(
      eq(schema.verification.identifier, `reset-password:${expiredToken}`)
    );
  const expiredReset = await auth.api.resetPassword({
    body: { token: expiredToken, newPassword: 'Another-password-789!' },
    headers,
    asResponse: true,
  });
  expect(expiredReset.ok).toBe(false);
});

it('completes the Clerk code flow with PKCE and links a verified existing account without granting credits again', async () => {
  vi.stubEnv('CLERK_OAUTH_CLIENT_ID', 'test-clerk-client');
  vi.stubEnv('CLERK_OAUTH_CLIENT_SECRET', 'test-clerk-secret');
  vi.stubEnv(
    'CLERK_OAUTH_DISCOVERY_URL',
    'https://clerk.example.com/.well-known/openid-configuration'
  );
  let profile = {
    sub: 'clerk-new-user',
    name: 'Google member',
    email: 'google-new@example.com',
    email_verified: true,
  };
  const tokenBodies: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      let body: unknown;
      if (url.includes('openid-configuration'))
        body = {
          issuer: 'https://clerk.example.com',
          authorization_endpoint: 'https://clerk.example.com/oauth/authorize',
          token_endpoint: 'https://clerk.example.com/oauth/token',
          userinfo_endpoint: 'https://clerk.example.com/oauth/userinfo',
        };
      else if (url.endsWith('/oauth/token')) {
        tokenBodies.push(String(init?.body));
        body = {
          access_token: 'test-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
        };
      } else if (url.endsWith('/oauth/userinfo')) body = profile;
      else throw new Error('Unexpected external request in Clerk test');
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      });
    })
  );
  try {
    const options = await getAuthOptions({
      resend_api_key: 'test-only',
      resend_sender_email: 'test@example.com',
    });
    const auth = betterAuth({
      ...options,
      baseURL: 'http://localhost:3000',
      secret: 'local-test-only-secret-not-for-production-12345',
      database: createAuthDatabase(state.database, 'pg'),
      rateLimit: { enabled: false },
    });
    async function googleLogin() {
      const start = await auth.handler(
        new Request('http://localhost:3000/api/auth/sign-in/oauth2', {
          method: 'POST',
          headers: {
            origin: 'http://localhost:3000',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            providerId: 'clerk',
            callbackURL: '/generate',
          }),
        })
      );
      expect(start.status).toBe(200);
      const target = new URL((await start.json()).url);
      expect(target.origin).toBe('https://clerk.example.com');
      expect(target.searchParams.get('code_challenge_method')).toBe('S256');
      expect(target.searchParams.get('code_challenge')).toBeTruthy();
      expect(target.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3000/api/auth/oauth2/callback/clerk'
      );
      const cookies = start.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      return auth.handler(
        new Request(
          `http://localhost:3000/api/auth/oauth2/callback/clerk?code=test-code&state=${target.searchParams.get('state')}`,
          { headers: { cookie: cookies } }
        )
      );
    }
    const first = await googleLogin();
    expect(first.status).toBe(302);
    expect(first.headers.get('location')).toBe('/generate');
    expect(tokenBodies[0]).toContain('code_verifier=');
    const [newUser] = await state.database
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, profile.email));
    expect(newUser.emailVerified).toBe(true);
    expect(await getRemainingCredits(newUser.id)).toBe(3);
    await googleLogin();
    expect(await getRemainingCredits(newUser.id)).toBe(3);

    profile = {
      ...profile,
      sub: 'clerk-existing-user',
      email: 'google-existing@example.com',
    };
    const native = await auth.api.signUpEmail({
      body: {
        email: profile.email,
        password: 'Example-password-123!',
        name: 'Existing member',
      },
      headers: new Headers({ origin: 'http://localhost:3000' }),
      asResponse: true,
    });
    const existingId = (await native.json()).user.id;
    const unverifiedLink = await googleLogin();
    expect(unverifiedLink.headers.get('location')).toContain(
      'account_not_linked'
    );
    await state.database
      .update(schema.user)
      .set({ emailVerified: true })
      .where(eq(schema.user.id, existingId));
    const linked = await googleLogin();
    expect(linked.headers.get('location')).toBe('/generate');
    const [linkedUser] = await state.database
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, profile.email));
    expect(linkedUser.id).toBe(existingId);
    expect(await getRemainingCredits(existingId)).toBe(3);
    expect(
      await state.database
        .select()
        .from(schema.credit)
        .where(eq(schema.credit.userId, existingId))
    ).toHaveLength(1);
    const forged = await auth.handler(
      new Request(
        'http://localhost:3000/api/auth/oauth2/callback/clerk?code=test-code&state=forged'
      )
    );
    expect(forged.headers.get('location')).not.toBe('/generate');
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
