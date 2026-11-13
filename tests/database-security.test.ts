import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';

import { verifyDatabaseSecurity } from '../scripts/lib/database-security';
import { createTestDatabase } from './database';

let close: (() => Promise<void>) | undefined;
afterAll(async () => close?.());

it('creates every application table with RLS and denies untrusted SQL roles', async () => {
  const { client, database } = await createTestDatabase();
  close = () => client.close();
  const tables = await client.query<{
    relname: string;
    relrowsecurity: boolean;
  }>(
    `SELECT relname,relrowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'`
  );
  expect(tables.rows.length).toBeGreaterThan(20);
  expect(tables.rows.filter((row) => !row.relrowsecurity)).toEqual([]);
  await database.execute(sql`CREATE ROLE test_untrusted`);
  await database.execute(sql`GRANT USAGE ON SCHEMA public TO test_untrusted`);
  // A mistakenly granted SELECT must still be stopped by RLS.
  await database.execute(sql`GRANT SELECT ON public."user" TO test_untrusted`);
  await database.execute(
    sql`INSERT INTO public."user" (id,name,email) VALUES ('owner','Owner','owner@example.invalid')`
  );
  await database.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE test_untrusted`);
    expect(await tx.execute(sql`SELECT id FROM public."user"`)).toMatchObject({
      rows: [],
    });
  });
  await expect(verifyDatabaseSecurity(database, 'public')).resolves.toContain(
    'verified'
  );
  await database.execute(
    sql`ALTER TABLE public."user" DISABLE ROW LEVEL SECURITY`
  );
  await expect(verifyDatabaseSecurity(database, 'public')).rejects.toThrow(
    'Database security verification failed'
  );
  await database.execute(
    sql`ALTER TABLE public."user" ENABLE ROW LEVEL SECURITY`
  );
  await database.execute(sql`CREATE ROLE anon`);
  await database.execute(sql`GRANT SELECT ON public."user" TO anon`);
  await expect(verifyDatabaseSecurity(database, 'public')).rejects.toThrow(
    'Database security verification failed'
  );
  await database.execute(sql`REVOKE SELECT ON public."user" FROM anon`);
  await expect(verifyDatabaseSecurity(database, 'public')).resolves.toContain(
    'verified'
  );
  await database.execute(
    sql`CREATE FUNCTION public.security_probe() RETURNS integer LANGUAGE sql AS 'SELECT 1'`
  );
  await expect(verifyDatabaseSecurity(database, 'public')).rejects.toThrow(
    'Database security verification failed'
  );
  await database.execute(
    sql`REVOKE EXECUTE ON FUNCTION public.security_probe() FROM PUBLIC, anon`
  );
  await expect(verifyDatabaseSecurity(database, 'public')).resolves.toContain(
    'verified'
  );
});
