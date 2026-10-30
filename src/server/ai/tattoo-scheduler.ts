import { eq } from 'drizzle-orm';
import { getRun, start } from 'workflow/api';

import { db } from '@/core/db';
import { tattooJob } from '@/config/db/schema';

import { tattooGenerationWorkflow } from './tattoo-workflow';

export async function ensureTattooWorkflow(projectId: string): Promise<void> {
  await db().transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(tattooJob)
      .where(eq(tattooJob.projectId, projectId))
      .for('update');
    if (!job || !['design', 'fusion', 'finalizing'].includes(job.stage)) return;
    if (job.workflowRunId) {
      if (
        job.workflowCheckedAt &&
        Date.now() - job.workflowCheckedAt.getTime() < 30_000
      )
        return;
      // Do not spawn duplicates on an observability/network error; let the caller retry.
      const status = await getRun(job.workflowRunId).status;
      if (status === 'pending' || status === 'running') {
        await tx
          .update(tattooJob)
          .set({ workflowCheckedAt: new Date() })
          .where(eq(tattooJob.projectId, projectId));
        return;
      }
    }
    const run = await start(tattooGenerationWorkflow, [projectId]);
    await tx
      .update(tattooJob)
      .set({ workflowRunId: run.runId, workflowCheckedAt: new Date() })
      .where(eq(tattooJob.projectId, projectId));
  });
}
