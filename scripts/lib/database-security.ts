import { sql } from 'drizzle-orm';

// Fail deployment if a migration exposes any application-schema object again.
// Only metadata is queried; user rows and credentials never enter build logs.
export async function verifyDatabaseSecurity(
  database: any,
  schemaName: string
) {
  const result = await database.execute(sql`
    SELECT 'table' AS kind, c.relname AS name
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=${schemaName} AND c.relkind IN ('r','p','v','m','S')
      AND (
        (c.relkind IN ('r','p') AND NOT c.relrowsecurity)
        OR EXISTS (
          SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
          AND CASE WHEN c.relkind='S'
            THEN has_sequence_privilege(r.rolname,c.oid,'USAGE,SELECT,UPDATE')
            ELSE has_table_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
              OR has_any_column_privilege(r.rolname,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
          END
        )
      )
    UNION ALL
    SELECT 'function', p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname=${schemaName} AND EXISTS (
      SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated')
      AND has_function_privilege(r.rolname,p.oid,'EXECUTE')
    )
  `);
  const rows = Array.isArray(result) ? result : result.rows;
  if (rows.length)
    throw new Error(
      'Database security verification failed: review RLS and public object privileges before deploying.'
    );
  return 'Database RLS and public object privileges verified';
}
