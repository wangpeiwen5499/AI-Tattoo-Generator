import { eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { studioJob, user } from '@/config/db/schema';
import { refundConsumedCredits } from '@/shared/models/credit';

import { assertAccountStudio, StudioError } from './policy';

// Call only after admin access + credit write permission. Provider IDs are supplied
// from a manual provider-console review; this operation never submits new work.
export async function resolveStudioReview(
  adminId: string,
  id: string,
  action: 'attach' | 'refund',
  providerTaskId?: string
) {
  assertAccountStudio();
  if (
    action === 'attach' &&
    (!providerTaskId || !/^[a-zA-Z0-9_-]{1,180}$/.test(providerTaskId))
  )
    throw new StudioError('Invalid provider task');
  const [target] = await db()
    .select()
    .from(studioJob)
    .where(eq(studioJob.id, id));
  if (!target) throw new StudioError('Job not found', 404);
  return db().transaction(async (tx) => {
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, target.userId))
      .for('no key update');
    const [job] = await tx
      .select()
      .from(studioJob)
      .where(eq(studioJob.id, id))
      .for('update');
    if (job.state === 'failed' && job.refunded && action === 'refund')
      return job;
    if (job.state !== 'review_required')
      throw new StudioError('Job is not awaiting review', 409);
    if (action === 'refund')
      await refundConsumedCredits({
        userId: job.userId,
        creditId: job.creditId,
        tx,
      });
    const [updated] = await tx
      .update(studioJob)
      .set(
        action === 'refund'
          ? {
              state: 'failed',
              refunded: true,
              error: `Credits restored after review by ${adminId}.`,
            }
          : {
              state: job.resultUrl ? 'storing' : 'running',
              providerTaskId,
              workflowRunId: null,
              leaseToken: null,
              leaseUntil: new Date(0),
              nextRunAt: new Date(),
              deadlineAt: new Date(Date.now() + 60 * 60_000),
              error: `Provider task attached after review by ${adminId}.`,
            }
      )
      .where(eq(studioJob.id, id))
      .returning();
    return updated;
  });
}
