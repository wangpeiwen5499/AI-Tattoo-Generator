import { and, eq } from 'drizzle-orm';

import { credit } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

// Caller holds the user lock, serializing consumption and generation compensation.
export async function revokeOrderGrant(
  tx: any,
  userId: string,
  orderNo: string,
  refundId: string
): Promise<number> {
  const grants = await tx
    .select()
    .from(credit)
    .where(
      and(
        eq(credit.userId, userId),
        eq(credit.orderNo, orderNo),
        eq(credit.transactionType, 'grant')
      )
    )
    .for('update');
  let recovered = 0;
  for (const grant of grants) {
    recovered += grant.remainingCredits;
    await tx
      .update(credit)
      .set({ remainingCredits: 0, status: 'refunded' })
      .where(eq(credit.id, grant.id));
  }
  if (recovered > 0)
    await tx.insert(credit).values({
      id: getUuid(),
      userId,
      orderNo,
      transactionNo: `waffo-refund:${refundId}`,
      transactionType: 'revoke',
      transactionScene: 'payment_refund',
      credits: -recovered,
      remainingCredits: 0,
      status: 'active',
      description: 'Unused order credits revoked after full payment refund',
    });
  return recovered;
}
