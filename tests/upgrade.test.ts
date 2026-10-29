import { sql } from 'drizzle-orm';
import { afterAll, expect, it } from 'vitest';

import { createTestDatabase } from './database';

let close: (() => Promise<void>) | undefined;
afterAll(async () => close?.());
it('upgrades an existing database twice without changing its usage records', async () => {
  const { database, client } = await createTestDatabase();
  close = () => client.close();
  await database.execute(sql`DROP TABLE tattoo_job`);
  await database.execute(
    sql`ALTER TABLE guest_free_usage DROP COLUMN upload_count`
  );
  await database.execute(
    sql`INSERT INTO guest_free_usage(ip, used_date, count) VALUES ('test-ip', '2026-10-29', 2)`
  );
  const { buildTattooJobsUpgrade, applyTattooJobsUpgrade } =
    await import('../scripts/lib/tattoo-jobs-upgrade');
  const statements = await buildTattooJobsUpgrade();
  await applyTattooJobsUpgrade(database, statements, 'public');
  await applyTattooJobsUpgrade(database, statements, 'public');
  const result = await client.query<{ count: number; upload_count: number }>(
    `SELECT count, upload_count FROM guest_free_usage WHERE ip = 'test-ip'`
  );
  expect(result.rows).toEqual([{ count: 2, upload_count: 0 }]);
  expect((await client.query(`SELECT * FROM tattoo_job`)).rows).toHaveLength(0);
});
