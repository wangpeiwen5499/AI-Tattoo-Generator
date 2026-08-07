/**
 * 游客免费额度查询（IP 限流：3 次/天）。
 */
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { guestFreeUsage } from '@/config/db/schema';

/** 原子认领一次游客免费额度。超限（≥3）返回 -1，否则 +1 返回新 count。 */
export async function claimGuestFree(ip: string): Promise<number> {
  return db().transaction(async (tx) => {
    const today = new Date().toISOString().split('T')[0];

    // SELECT ... FOR UPDATE
    const rows = await tx
      .select()
      .from(guestFreeUsage)
      .where(
        and(
          eq(guestFreeUsage.ip, ip),
          eq(guestFreeUsage.usedDate, today)
        )
      )
      .for('update');

    const existing = rows[0];

    if (existing && existing.count >= 3) {
      return -1;
    }

    if (existing) {
      const [updated] = await tx
        .update(guestFreeUsage)
        .set({ count: sql`${guestFreeUsage.count} + 1` })
        .where(
          and(
            eq(guestFreeUsage.ip, ip),
            eq(guestFreeUsage.usedDate, today)
          )
        )
        .returning({ count: guestFreeUsage.count });
      return updated?.count ?? 1;
    }

    await tx.insert(guestFreeUsage).values({ ip, usedDate: today, count: 1 });
    return 1;
  });
}
