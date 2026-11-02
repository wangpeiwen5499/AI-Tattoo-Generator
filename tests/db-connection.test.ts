import { expect, it } from 'vitest';

import { resolveDatabaseConnection } from '@/core/db/connection';

it.each(['production', 'preview'])(
  'uses Supabase transaction pooling in Vercel %s while preserving credentials and query',
  (environment) => {
    const input =
      'postgresql://postgres.tenant:p%40ss%3A%2F%3F@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require&application_name=tattoo';
    const result = resolveDatabaseConnection(input, environment);
    expect(result.url).toBe(input.replace(':5432/', ':6543/'));
    expect(result.transactionPooler).toBe(true);
  }
);
it('normalizes the implicit session port', () => {
  expect(
    resolveDatabaseConnection(
      'postgres://u:p@aws-0.pooler.supabase.com/postgres',
      'production'
    ).url
  ).toBe('postgres://u:p@aws-0.pooler.supabase.com:6543/postgres');
});
it.each([
  ['postgres://u:p@aws-0.pooler.supabase.com:5432/postgres', undefined],
  ['postgres://u:p@aws-0.pooler.supabase.com:5432/postgres', 'development'],
  ['postgres://u:p@db.tenant.supabase.co:5432/postgres', 'production'],
  ['postgres://u:p@pooler.supabase.com.evil.test:5432/postgres', 'production'],
  ['postgres://u:p@fakepooler.supabase.com:5432/postgres', 'production'],
  ['postgres://u:p@localhost:5432/postgres', 'production'],
  ['postgres://u:p@aws-0.pooler.supabase.com:9999/postgres', 'production'],
])('leaves unrelated endpoints untouched', (input, environment) => {
  expect(resolveDatabaseConnection(input, environment).url).toBe(input);
});
