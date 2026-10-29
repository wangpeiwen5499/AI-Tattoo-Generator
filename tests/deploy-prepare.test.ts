import { expect, it } from 'vitest';

import { missingDeploymentSettings } from '../scripts/lib/deploy-prerequisites';

const configured = {
  DATABASE_URL: 'postgres://example.invalid/test',
  AUTH_SECRET: 'test-only-secret-longer-than-thirty-two-characters',
  R2_ACCOUNT_ID: 'test',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  R2_BUCKET_NAME: 'test',
  R2_PUBLIC_URL: 'https://images.example.com',
  KIE_API_KEY: 'test',
  RESEND_API_KEY: 'test',
  RESEND_SENDER_EMAIL: 'test@example.com',
};
it('reports missing setting names without exposing their values', () => {
  const missing = missingDeploymentSettings({
    ...configured,
    AUTH_SECRET: 'too-short',
    RESEND_API_KEY: '',
  });
  expect(missing).toEqual([
    'AUTH_SECRET (at least 32 characters)',
    'RESEND_API_KEY',
  ]);
});
it('accepts the production settings and database-stored mail settings', () => {
  expect(missingDeploymentSettings(configured)).toEqual([]);
  expect(
    missingDeploymentSettings(
      {
        ...configured,
        RESEND_API_KEY: undefined,
        RESEND_SENDER_EMAIL: undefined,
      },
      { resend_api_key: 'test-db-key', resend_sender_email: 'test@example.com' }
    )
  ).toEqual([]);
});
