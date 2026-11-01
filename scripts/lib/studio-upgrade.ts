import { sql } from 'drizzle-orm';

export async function applyStudioUpgrade(database: any, schemaName: string) {
  const s = '"' + schemaName.replace(/"/g, '""') + '"';
  await database.transaction(async (tx: any) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(7261033)`);
    const statements = `CREATE TABLE IF NOT EXISTS ${s}.studio_asset (
      id text PRIMARY KEY,user_id text NOT NULL REFERENCES ${s}."user"(id) ON DELETE CASCADE,key text NOT NULL,content_type text NOT NULL,created_at timestamp NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS idx_studio_asset_owner ON ${s}.studio_asset(user_id);
      CREATE TABLE IF NOT EXISTS ${s}.studio_record (
      id text PRIMARY KEY,user_id text NOT NULL REFERENCES ${s}."user"(id) ON DELETE CASCADE,collection text NOT NULL,operation_id text UNIQUE,name text,prompt text NOT NULL DEFAULT '',source text,resolution text,
      image text NOT NULL REFERENCES ${s}.studio_asset(id),original text REFERENCES ${s}.studio_asset(id),draft text REFERENCES ${s}.studio_asset(id),design_id text,deleted_at timestamp,created_at timestamp NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS idx_studio_record_owner ON ${s}.studio_record(user_id,collection);
      CREATE TABLE IF NOT EXISTS ${s}.studio_job (
      id text PRIMARY KEY,user_id text NOT NULL REFERENCES ${s}."user"(id) ON DELETE CASCADE,operation_id text NOT NULL UNIQUE,kind text NOT NULL,input text NOT NULL,resolution text NOT NULL,credit_id text NOT NULL REFERENCES ${s}.credit(id),state text NOT NULL DEFAULT 'queued',provider_task_id text,result_url text,asset_id text REFERENCES ${s}.studio_asset(id),record_id text REFERENCES ${s}.studio_record(id),workflow_run_id text,lease_token text,lease_until timestamp NOT NULL DEFAULT now(),next_run_at timestamp NOT NULL DEFAULT now(),refunded boolean NOT NULL DEFAULT false,error text,created_at timestamp NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS idx_studio_job_owner ON ${s}.studio_job(user_id,state);
      ALTER TABLE ${s}.studio_job ADD COLUMN IF NOT EXISTS deadline_at timestamp NOT NULL DEFAULT (now() + interval '60 minutes');`;
    for (const statement of statements.split(';').filter((part) => part.trim()))
      await tx.execute(sql.raw(statement));
  });
  return 'Account studio tables verified; existing balances unchanged';
}
