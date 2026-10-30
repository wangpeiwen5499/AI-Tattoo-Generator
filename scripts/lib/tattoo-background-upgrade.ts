import { sql } from 'drizzle-orm';

export async function applyTattooBackgroundUpgrade(
  database: any,
  schemaName: string
) {
  const quoted = '"' + schemaName.replace(/"/g, '""') + '"';
  await database.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7261032)`);
    await tx.execute(
      sql.raw(
        `ALTER TABLE ${quoted}.tattoo_job ADD COLUMN IF NOT EXISTS workflow_run_id text, ADD COLUMN IF NOT EXISTS workflow_checked_at timestamp`
      )
    );
  });
  return 'Tattoo background run columns verified';
}
