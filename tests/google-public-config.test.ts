import { afterEach, expect, it, vi } from 'vitest';

import { getPublicConfigs } from '@/shared/models/config';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: unknown) => fn,
}));
vi.mock('@/core/db', () => ({ db: vi.fn() }));
vi.mock('@/config', () => ({ envConfigs: { database_url: '' } }));
vi.mock('@/shared/services/settings', () => ({
  getAllSettingNames: async () => [
    'google_auth_enabled',
    'google_client_id',
    'google_client_secret',
  ],
  publicSettingNames: ['google_auth_enabled', 'google_client_id'],
}));

afterEach(() => vi.unstubAllEnvs());
it('enables direct Google only when complete and never exposes secrets or Clerk keys', async () => {
  vi.stubEnv('GOOGLE_AUTH_ENABLED', 'true');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret-value');
  vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_live_old');
  const ready = await getPublicConfigs();
  expect(ready.google_auth_enabled).toBe('true');
  expect(ready.clerk_google_auth_enabled).toBe('false');
  expect(ready).not.toHaveProperty('google_client_secret');
  expect(ready).not.toHaveProperty('clerk_publishable_key');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
  expect((await getPublicConfigs()).google_auth_enabled).toBe('false');
});
