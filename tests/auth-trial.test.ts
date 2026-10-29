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
  mail: [] as Array<{ to: string; code: string }>,
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
      state.mail.push({ to: mail.to, code: mail.react.code });
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
