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
    .where(and(eq(guestFreeUsage.ip, ip), eq(guestFreeUsage.usedDate, today)))
    .limit(1);
  const used = rows[0]?.count ?? 0;
  return Math.max(0, GUEST_FREE_LIMIT - used);
}

/**
 * 确保游客在 user 表存在（满足 tattoo_project.user_id 外键约束）。
 * 幂等；utmSource='guest' 便于后台识别与清理。
 */
export async function ensureGuestUser(
  guestId: string,
  tx: any = db()
): Promise<void> {
  await tx
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
export async function claimGuestFree(
  ip: string,
  tx: any = db()
): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const [claimed] = await tx
    .insert(guestFreeUsage)
    .values({ ip, usedDate: today, count: 1 })
    .onConflictDoUpdate({
      target: [guestFreeUsage.ip, guestFreeUsage.usedDate],
      set: { count: sql`${guestFreeUsage.count} + 1` },
      setWhere: sql`${guestFreeUsage.count} < ${GUEST_FREE_LIMIT}`,
    })
    .returning({ count: guestFreeUsage.count });
  return claimed?.count ?? -1;
}

/** Persistent per-IP upload budget: rotating a cookie cannot mint unlimited upload URLs. */
export async function claimUpload(ip: string, limit: number): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const [claimed] = await db()
    .insert(guestFreeUsage)
    .values({ ip, usedDate: today, count: 0, uploadCount: 1 })
    .onConflictDoUpdate({
      target: [guestFreeUsage.ip, guestFreeUsage.usedDate],
      set: { uploadCount: sql`${guestFreeUsage.uploadCount} + 1` },
      setWhere: sql`${guestFreeUsage.uploadCount} < ${limit}`,
    })
    .returning({ count: guestFreeUsage.uploadCount });
  return claimed?.count ?? -1;
}

/** Account creation budget, shared across instances; separate from upload counters. */
export async function claimRegistrationAttempt(ip: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const [claimed] = await db()
    .insert(guestFreeUsage)
    .values({ ip: `signup:${ip}`, usedDate: today, count: 1 })
    .onConflictDoUpdate({
      target: [guestFreeUsage.ip, guestFreeUsage.usedDate],
      set: { count: sql`${guestFreeUsage.count} + 1` },
      setWhere: sql`${guestFreeUsage.count} < 10`,
    })
    .returning({ count: guestFreeUsage.count });
  return claimed?.count ?? -1;
}
