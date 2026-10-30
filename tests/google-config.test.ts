import { expect, it } from 'vitest';

import { getGoogleProviderConfig } from '@/core/auth/google';

it('requires enabled Google and both credentials', () => {
  expect(getGoogleProviderConfig({})).toBeNull();
  expect(
    getGoogleProviderConfig({
      google_auth_enabled: 'true',
      google_client_id: 'id',
    })
  ).toBeNull();
  expect(
    getGoogleProviderConfig({
      google_auth_enabled: 'false',
      google_client_id: 'id',
      google_client_secret: 'secret',
    })
  ).toBeNull();
  expect(
    getGoogleProviderConfig({
      google_auth_enabled: 'true',
      google_client_id: ' id ',
      google_client_secret: ' secret ',
    })
  ).toEqual({
    clientId: 'id',
    clientSecret: 'secret',
    prompt: 'select_account',
  });
});
