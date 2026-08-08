/**
 * 游客免费额度查询（IP 限流：3 次/天）。
 */
import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { guestFreeUsage, user } from '@/config/db/schema';

/** 游客每日免费额度（按 IP 限流） */
export const GUEST_FREE_LIMIT = 3;

/** 查询某 IP 今日剩余的游客免费额度（只读，不认领）。 */
export async function getGuestRemaining(ip: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const rows = await db()
    .select({ count: guestFreeUsage.count })
    .from(guestFreeUsage)
    .where(
      and(eq(guestFreeUsage.ip, ip), eq(guestFreeUsage.usedDate, today))
    )
    .limit(1);
  const used = rows[0]?.count ?? 0;
  return Math.max(0, GUEST_FREE_LIMIT - used);
}

/**
 * 确保游客在 user 表存在（满足 tattoo_project.user_id 外键约束）。
 * 幂等；utmSource='guest' 便于后台识别与清理。
 */
export async function ensureGuestUser(guestId: string): Promise<void> {
  await db()
    .insert(user)
    .values({
      id: guestId,
      name: 'Guest',
      email: `${guestId}@guest.local`,
      emailVerified: false,
      utmSource: 'guest',
    })
    .onConflictDoNothing({ target: user.id });
}

/** 原子认领一次游客免费额度。超限（≥GUEST_FREE_LIMIT）返回 -1，否则 +1 返回新 count。 */
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

    if (existing && existing.count >= GUEST_FREE_LIMIT) {
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
