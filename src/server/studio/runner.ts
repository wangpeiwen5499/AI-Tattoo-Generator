import { and, asc, inArray, lte } from 'drizzle-orm';

import { db } from '@/core/db';
import { studioJob } from '@/config/db/schema';

import { assertStudioProduction } from './policy';
import { ensureStudioWorkflow } from './scheduler';
import { ACTIVE, advanceStudioJob } from './service';

export async function advanceDueStudioJobs(limit = 3) {
  assertStudioProduction();
  const now = new Date();
  const jobs = await db()
    .select({ id: studioJob.id })
    .from(studioJob)
    .where(
      and(
        inArray(studioJob.state, ACTIVE),
        lte(studioJob.nextRunAt, now),
        lte(studioJob.leaseUntil, now)
      )
    )
    .orderBy(asc(studioJob.nextRunAt))
    .limit(Math.max(1, Math.min(limit, 5)));
  await Promise.allSettled(
    jobs.map(async (job) => {
      // Start/recover a durable worker, but keep read/transfer progress possible if
      // Workflow scheduling is temporarily unavailable. The same DB lease applies.
      await ensureStudioWorkflow(job.id).catch(() => {});
      await advanceStudioJob(job.id);
    })
  );
  return jobs.length;
}
