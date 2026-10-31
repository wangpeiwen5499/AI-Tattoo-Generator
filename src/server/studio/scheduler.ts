import { eq } from 'drizzle-orm';
import { getRun, start } from 'workflow/api';

import { db } from '@/core/db';
import { studioJob } from '@/config/db/schema';

import { assertStudioProduction } from './policy';
import { ACTIVE } from './service';
import { studioWorkflow } from './workflow';

export async function ensureStudioWorkflow(id: string) {
  assertStudioProduction();
  await db().transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(studioJob)
      .where(eq(studioJob.id, id))
      .for('update');
    if (!job || !ACTIVE.includes(job.state)) return;
    if (job.workflowRunId) {
      const status = await getRun(job.workflowRunId).status;
      if (status === 'running' || status === 'pending') return;
    }
    const run = await start(studioWorkflow, [id]);
    await tx
      .update(studioJob)
      .set({ workflowRunId: run.runId })
      .where(eq(studioJob.id, id));
  });
}
