import { sql } from 'drizzle-orm';

export function uploadBudgetUpgrade(schemaName: string): string {
  return `ALTER TABLE ${quote(schemaName)}.${quote('guest_free_usage')} ADD COLUMN IF NOT EXISTS upload_count integer NOT NULL DEFAULT 0`;
}

export async function buildTattooJobsUpgrade(): Promise<string[]> {
  const { generateDrizzleJson, generateMigration } =
    await import('drizzle-kit/api');
  const { tattooJob } = await import('../../src/config/db/schema');
  return generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson({ tattooJob })
  );
}

export async function applyTattooJobsUpgrade(
  database: any,
  statements: string[],
  schemaName: string
): Promise<string> {
  return database.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7261029)`);
    const result = await tx.execute(
      sql`SELECT to_regclass(${`${quote(schemaName)}.${quote('tattoo_job')}`}) AS name`
    );
    const rows = Array.isArray(result) ? result : result.rows;
    await tx.execute(sql.raw(uploadBudgetUpgrade(schemaName)));
    if (rows[0]?.name)
      return 'Already installed; upload budget column verified';
    for (const statement of statements) await tx.execute(sql.raw(statement));
    return 'tattoo_job installed';
  });
}

function quote(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}
