import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';

// Global database connection instance (singleton pattern)
let dbInstance: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

export function db() {
  let databaseUrl = envConfigs.database_url;

  let isHyperdrive = false;
  const schemaName = (envConfigs.db_schema || 'public').trim();
  const connectionSchemaOptions =
    schemaName && schemaName !== 'public'
      ? { connection: { options: `-c search_path=${schemaName}` } }
      : {};

  if (isCloudflareWorker) {
    const { env }: { env: any } = { env: {} };
    // Detect if set Hyperdrive
    isHyperdrive = 'HYPERDRIVE' in env;

    if (isHyperdrive) {
      const hyperdrive = env.HYPERDRIVE;
      databaseUrl = hyperdrive.connectionString;
      console.log('using Hyperdrive connection');
    }
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  // In Cloudflare Workers, create new connection each time
  if (isCloudflareWorker) {
    console.log('in Cloudflare Workers environment');
    // Workers environment uses minimal configuration
    const client = postgres(databaseUrl, {
      prepare: false,
      max: 1, // Limit to 1 connection in Workers
      idle_timeout: 10, // Shorter timeout for Workers
      connect_timeout: 5,
      ...connectionSchemaOptions,
    });

    return drizzle(client);
  }

  // A warm Node process must share one bounded pool. Creating a pool on every
  // db() call multiplies connections across auth/config/model queries even when
  // each individual pool has max=1. The legacy flag only opts into custom sizing.
  if (dbInstance) return dbInstance;
  const configuredMax = Number(envConfigs.db_max_connections);
  const max =
    envConfigs.db_singleton_enabled === 'true' &&
    Number.isSafeInteger(configuredMax) &&
    configuredMax > 0
      ? configuredMax
      : 1;
  client = postgres(databaseUrl, {
    prepare: false,
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    ...connectionSchemaOptions,
  });
  dbInstance = drizzle({ client });
  return dbInstance;
}

// Detach before awaiting shutdown so concurrent callers cannot acquire a pool
// that is already closing. Worker clients remain scoped to their invocation.
export async function closeDb() {
  const closingClient = client;
  client = null;
  dbInstance = null;
  if (closingClient) await closingClient.end();
}
