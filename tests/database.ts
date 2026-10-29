import { PGlite } from '@electric-sql/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';

import * as schema from '@/config/db/schema';

let ddl: string[] | undefined;
export async function createTestDatabase() {
  const client = new PGlite();
  ddl ??= await generateMigration(
    generateDrizzleJson({}),
    generateDrizzleJson(schema)
  );
  for (const statement of ddl) await client.exec(statement);
  return { client, database: drizzle(client) };
}
