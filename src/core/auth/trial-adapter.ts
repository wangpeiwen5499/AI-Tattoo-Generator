import type { BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import * as schema from '@/config/db/schema';
import { grantCreditsForNewUser } from '@/shared/models/credit';

// Creating an auth user and their welcome gift must succeed together. BetterAuth's
// create.after hooks run after commit, so the gift belongs inside the adapter.
export function createAuthDatabase(
  database: any,
  provider: 'sqlite' | 'pg' | 'mysql'
) {
  return (options: BetterAuthOptions) => {
    const base = drizzleAdapter(database, { provider, schema })(options);
    const adapter: typeof base = {
      ...base,
      create: async <T extends Record<string, any>, R = T>(args: {
        model: string;
        data: Omit<T, 'id'>;
        select?: string[];
        forceAllowId?: boolean;
      }): Promise<R> => {
        if (args.model !== 'user') return base.create<T, R>(args);
        return database.transaction(async (tx: any) => {
          const scoped = drizzleAdapter(tx, { provider, schema })(options);
          const created = await scoped.create<T, R>(args);
          await grantCreditsForNewUser(created as any, tx);
          return created;
        });
      },
      // Preserve the wrapped create method in BetterAuth's transaction fallback.
      // The base adapter also defaults to transaction:false; user+gift above is atomic.
      transaction: async (callback) => callback(adapter),
    };
    return adapter;
  };
}
