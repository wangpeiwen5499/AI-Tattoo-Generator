import { sql } from 'drizzle-orm';

export async function applyPaymentRefundsUpgrade(
  database: any,
  schemaName: string
): Promise<string> {
  const quoted = '"' + schemaName.replace(/"/g, '""') + '"';
  return database.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7261030)`);
    await tx.execute(
      sql.raw(
        `ALTER TABLE ${quoted}."order" ADD COLUMN IF NOT EXISTS refund_info text`
      )
    );
    return 'Order refund ledger column verified';
  });
}
