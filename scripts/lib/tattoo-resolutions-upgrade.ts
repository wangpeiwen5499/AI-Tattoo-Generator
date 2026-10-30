import { sql } from 'drizzle-orm';

export async function applyTattooResolutionsUpgrade(
  database: any,
  schemaName: string
): Promise<string> {
  const quoted = '"' + schemaName.replace(/"/g, '""') + '"';
  return database.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7261031)`);
    await tx.execute(
      sql.raw(
        `ALTER TABLE ${quoted}.tattoo_project ADD COLUMN IF NOT EXISTS resolution text NOT NULL DEFAULT '1K', ADD COLUMN IF NOT EXISTS credits_cost integer NOT NULL DEFAULT 1`
      )
    );
    return 'Tattoo resolution and cost snapshot columns verified';
  });
}
