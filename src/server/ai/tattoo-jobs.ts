import { randomUUID } from 'node:crypto';
import { BODY_PART_LABELS, BODY_PARTS, type BodyPart } from '@/lib/constants';
import { fetchUrlAndUpload, getPublicUrl } from '@/lib/r2';
import {
  parseTattooResolution,
  tattooResolutionPolicy,
  type TattooResolution,
} from '@/lib/tattoo-resolution';
import type { Actor } from '@/server/auth/actor';
import { isOwnedUploadKey } from '@/server/storage/upload-policy';
import { and, eq, inArray, lte } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  tattooGeneration,
  tattooJob,
  tattooProject,
  user,
} from '@/config/db/schema';
import { consumeCredits, refundConsumedCredits } from '@/shared/models/credit';

import { createTask, getRecordInfo } from './kie-client';

const ACTIVE_STAGES = ['design', 'fusion', 'finalizing'];
const LEASE_MS = 90_000;
export const JOB_TIMEOUT_MS = 20 * 60_000;
type Job = typeof tattooJob.$inferSelect;
type Task = {
  bodyPart: BodyPart;
  status: 'pending' | 'submitting' | 'running' | 'completed' | 'failed';
  taskId?: string;
  r2Key?: string;
  r2Url?: string;
  checkedAt?: number;
  error?: string;
};

export class GenerationRequestError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

export async function startTattooGeneration(input: {
  actor: Actor;
  bodyPhotoKey: string;
  prompt: string;
  requestId: string;
  ip: string;
  resolution?: TattooResolution;
}): Promise<string> {
  const { actor, bodyPhotoKey, prompt, requestId } = input;
  if (actor.type !== 'user')
    throw new GenerationRequestError(
      'Sign in to generate your own tattoo.',
      401
    );
  let resolution: TattooResolution;
  try {
    resolution = parseTattooResolution(input.resolution);
  } catch {
    throw new GenerationRequestError('Unsupported image resolution');
  }
  const policy = tattooResolutionPolicy(resolution);
  if (!isOwnedUploadKey(bodyPhotoKey, actor.id))
    throw new GenerationRequestError('Invalid photo ownership');
  if (
    !prompt.trim() ||
    prompt.length > 500 ||
    !/^[0-9a-f-]{36}$/i.test(requestId)
  )
    throw new GenerationRequestError('Invalid generation request');
  return db().transaction(async (tx) => {
    const [owner] = await tx
      .select({ id: user.id, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, actor.id))
      .for('no key update');
    if (!owner) throw new GenerationRequestError('User not found', 401);
    if (!owner.emailVerified)
      throw new GenerationRequestError(
        'Verify your email before using credits.',
        403
      );
    const [existing] = await tx
      .select()
      .from(tattooJob)
      .where(eq(tattooJob.requestId, requestId));
    if (existing) {
      const [project] = await tx
        .select()
        .from(tattooProject)
        .where(eq(tattooProject.id, existing.projectId));
      if (
        existing.userId !== actor.id ||
        project.bodyPhotoKey !== bodyPhotoKey ||
        project.prompt !== prompt.trim() ||
        project.resolution !== resolution
      )
        throw new GenerationRequestError('Request ID already used', 409);
      return existing.projectId;
    }
    const [active] = await tx
      .select({ id: tattooJob.projectId })
      .from(tattooJob)
      .where(
        and(
          eq(tattooJob.userId, actor.id),
          inArray(tattooJob.stage, ACTIVE_STAGES)
        )
      )
      .limit(1);
    if (active)
      throw new GenerationRequestError(
        'A generation is already in progress. Resume it before starting another.',
        409
      );
    let creditId: string;
    try {
      creditId = (
        await consumeCredits({
          userId: actor.id,
          credits: policy.credits,
          scene: 'tattoo',
          description: `Tattoo preview (${resolution})`,
          metadata: JSON.stringify({ resolution, creditsCost: policy.credits }),
          tx,
        })
      ).id;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Insufficient'))
        throw new GenerationRequestError('Insufficient credits', 402);
      throw error;
    }
    const projectId = randomUUID();
    await tx.insert(tattooProject).values({
      id: projectId,
      userId: actor.id,
      bodyPhotoKey,
      bodyPhotoUrl: getPublicUrl(bodyPhotoKey),
      prompt: prompt.trim(),
      resolution,
      creditsCost: policy.credits,
      status: 'processing',
    });
    await tx.insert(tattooJob).values({
      projectId,
      userId: actor.id,
      requestId,
      creditId,
      tasks: JSON.stringify(
        BODY_PARTS.map((bodyPart) => ({ bodyPart, status: 'pending' }))
      ),
      expiresAt: new Date(Date.now() + policy.timeoutMs),
      leaseUntil: new Date(0),
      nextRunAt: new Date(),
    });
    return projectId;
  });
}

export async function getTattooJob(projectId: string): Promise<Job | null> {
  const [job] = await db()
    .select()
    .from(tattooJob)
    .where(eq(tattooJob.projectId, projectId));
  return job ?? null;
}

export async function getActiveTattooJob(userId: string): Promise<Job | null> {
  const [job] = await db()
    .select()
    .from(tattooJob)
    .where(
      and(eq(tattooJob.userId, userId), inArray(tattooJob.stage, ACTIVE_STAGES))
    )
    .limit(1);
  return job ?? null;
}

// One bounded provider operation per invocation; persisted IDs survive process restarts.
export async function advanceTattooJob(projectId: string): Promise<void> {
  const token = randomUUID();
  const now = new Date();
  const [claimed] = await db()
    .update(tattooJob)
    .set({ leaseToken: token, leaseUntil: new Date(now.getTime() + LEASE_MS) })
    .where(
      and(
        eq(tattooJob.projectId, projectId),
        inArray(tattooJob.stage, ACTIVE_STAGES),
        lte(tattooJob.leaseUntil, now),
        lte(tattooJob.nextRunAt, now)
      )
    )
    .returning();
  if (!claimed) return;
  let job = claimed;
  const save = async (changes: Partial<typeof tattooJob.$inferInsert>) => {
    const [updated] = await db()
      .update(tattooJob)
      .set({ ...changes, leaseUntil: new Date(Date.now() + LEASE_MS) })
      .where(
        and(eq(tattooJob.projectId, projectId), eq(tattooJob.leaseToken, token))
      )
      .returning();
    if (!updated) throw new Error('Job lease lost');
    job = updated;
  };
  try {
    const [project] = await db()
      .select()
      .from(tattooProject)
      .where(eq(tattooProject.id, projectId));
    if (!project) throw new Error('Project not found');
    if (job.stage === 'finalizing') {
      await save({
        stage: 'finalizing',
        error: job.error || 'Generation timed out. Please try again.',
      });
      await finalizeJob(job, token);
      return;
    }
    const expired = job.expiresAt.getTime() <= Date.now();
    if (expired) {
      // Collect existing paid provider work before settling a task abandoned by its browser.
      if (
        job.stage === 'design' &&
        job.designTaskId &&
        job.designTaskId !== 'submitting'
      ) {
        try {
          const info = await getRecordInfo(job.designTaskId);
          if (info.state === 'success' && !project.tattooDesignUrl) {
            const stored = await fetchUrlAndUpload(
              resultUrl(info.resultJson),
              `outputs/${job.userId}/${projectId}/design.png`,
              tattooResolutionPolicy(project.resolution).maxImageBytes,
              true
            );
            await db()
              .update(tattooProject)
              .set({
                tattooDesignKey: stored.key,
                tattooDesignUrl: stored.publicUrl,
              })
              .where(eq(tattooProject.id, projectId));
          }
        } catch {
          /* Unavailable expired work is settled with the original charge reversed. */
        }
      }
      const tasks: Task[] = JSON.parse(job.tasks);
      await collectBodyResults(tasks, project.resolution, job, async () =>
        save({ tasks: JSON.stringify(tasks) })
      );
      await save({
        stage: 'finalizing',
        error: 'Generation timed out. Available results have been recovered.',
      });
      await finalizeJob(job, token);
      return;
    }
    if (job.stage === 'design') {
      if (job.designTaskId === 'submitting') {
        await save({
          stage: 'finalizing',
          error: 'Provider submission was interrupted. Please try again.',
        });
        await finalizeJob(job, token);
      } else if (!job.designTaskId) {
        // Persist intent before issuing a billable request. Ambiguous submissions are never retried.
        await save({ designTaskId: 'submitting' });
        try {
          const taskId = await createTask({
            model: 'gpt-image-2-text-to-image',
            input: {
              prompt: `${project.prompt}, tattoo design, white background, clean bold lines, high contrast, stencil style, professional tattoo flash`,
              aspect_ratio: '1:1',
              resolution: parseTattooResolution(project.resolution),
            },
          });
          await save({ designTaskId: taskId });
        } catch {
          await save({
            stage: 'finalizing',
            error: 'Unable to submit the tattoo design. Please try again.',
          });
          await finalizeJob(job, token);
        }
      } else {
        const info = await getRecordInfo(job.designTaskId);
        if (info.state === 'failed' || info.state === 'fail') {
          await save({
            stage: 'finalizing',
            error: 'The AI provider could not generate this design.',
          });
          await finalizeJob(job, token);
        } else if (info.state === 'success') {
          const source = resultUrl(info.resultJson);
          const stored = await fetchUrlAndUpload(
            source,
            `outputs/${job.userId}/${projectId}/design.png`,
            tattooResolutionPolicy(project.resolution).maxImageBytes,
            true
          );
          await db().transaction(async (tx) => {
            await assertLease(tx, projectId, token);
            await tx
              .update(tattooProject)
              .set({
                tattooDesignKey: stored.key,
                tattooDesignUrl: stored.publicUrl,
              })
              .where(eq(tattooProject.id, projectId));
            await tx
              .update(tattooJob)
              .set({ stage: 'fusion' })
              .where(eq(tattooJob.projectId, projectId));
          });
        }
      }
      return;
    }
    const tasks: Task[] = JSON.parse(job.tasks);
    const pending = tasks.filter(
      (task) => task.status === 'pending' || task.status === 'submitting'
    );
    if (pending.length) {
      const fresh = pending.filter((task) => task.status === 'pending');
      for (const task of pending) {
        if (task.status === 'submitting') {
          task.status = 'failed';
          task.error = 'Provider submission was interrupted';
        } else task.status = 'submitting';
      }
      await save({ tasks: JSON.stringify(tasks) });
      let persistence = Promise.resolve();
      await Promise.all(
        fresh.map(async (task) => {
          try {
            task.taskId = await createTask({
              model: 'gpt-image-2-image-to-image',
              input: {
                prompt: `Apply this tattoo design naturally on the ${BODY_PART_LABELS[task.bodyPart].toLowerCase()} of the person in the photo. Make it look real with natural skin texture, lighting, perspective, and body contour. Do not change anything else in the photo.`,
                input_urls: [project.bodyPhotoUrl, project.tattooDesignUrl!],
                aspect_ratio: '3:4',
                resolution: parseTattooResolution(project.resolution),
              },
            });
            task.status = 'running';
          } catch {
            task.status = 'failed';
            task.error = 'Unable to submit body preview';
          }
          // Persist each returned ID promptly; serialize snapshots under the job lease.
          persistence = persistence.then(() =>
            save({ tasks: JSON.stringify(tasks) })
          );
          await persistence;
        })
      );
      return;
    }
    await collectBodyResults(tasks, project.resolution, job, async () =>
      save({ tasks: JSON.stringify(tasks) })
    );
    if (tasks.some((task) => task.status === 'running')) return;
    await save({ stage: 'finalizing' });
    await finalizeJob(job, token);
  } catch (error) {
    // Read/download failures are safe to retry; billable creation is handled separately above.
    console.error(
      '[tattoo-job] step failed',
      projectId,
      error instanceof Error ? error.message : 'Unknown error'
    );
  } finally {
    await db()
      .update(tattooJob)
      .set({
        leaseToken: null,
        leaseUntil: new Date(0),
        nextRunAt: new Date(Date.now() + 3000),
      })
      .where(
        and(eq(tattooJob.projectId, projectId), eq(tattooJob.leaseToken, token))
      );
  }
}

async function collectBodyResults(
  tasks: Task[],
  resolution: string,
  job: Job,
  persist: () => Promise<void>
) {
  const running = tasks.filter(
    (task) => task.status === 'running' && task.taskId
  );
  // Provider status requests are small and independent; large image transfers remain bounded and serial.
  const states = await Promise.allSettled(
    running.map((task) => getRecordInfo(task.taskId!))
  );
  for (let i = 0; i < running.length; i++) {
    const task = running[i];
    const state = states[i];
    if (state.status === 'rejected') continue;
    const info = state.value;
    task.checkedAt = Date.now();
    if (info.state === 'failed' || info.state === 'fail') {
      task.status = 'failed';
      task.error = 'Body preview failed';
    } else if (info.state === 'success') {
      try {
        const stored = await fetchUrlAndUpload(
          resultUrl(info.resultJson),
          `outputs/${job.userId}/${job.projectId}/${task.bodyPart}.png`,
          tattooResolutionPolicy(resolution).maxImageBytes
        );
        task.status = 'completed';
        task.r2Key = stored.key;
        task.r2Url = stored.publicUrl;
      } catch (error) {
        console.error(
          '[tattoo-job] body result transfer failed',
          job.projectId,
          task.bodyPart
        );
      }
    }
    await persist();
  }
}

function resultUrl(json: string | null): string {
  const result = JSON.parse(json || '{}');
  const url = new URL(result.resultUrls?.[0]);
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('Invalid provider result');
  return url.href;
}

async function assertLease(tx: any, projectId: string, token: string) {
  const [current] = await tx
    .select()
    .from(tattooJob)
    .where(eq(tattooJob.projectId, projectId))
    .for('update');
  if (
    !current ||
    current.leaseToken !== token ||
    current.leaseUntil.getTime() <= Date.now()
  )
    throw new Error('Job lease lost');
  return current as Job;
}

async function finalizeJob(job: Job, token: string): Promise<void> {
  await db().transaction(async (tx) => {
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, job.userId))
      .for('no key update');
    const current = await assertLease(tx, job.projectId, token);
    const tasks: Task[] = JSON.parse(current.tasks);
    const successful = tasks.filter(
      (task) => task.status === 'completed' && task.r2Url
    );
    const incomplete = successful.length !== BODY_PARTS.length;
    if (incomplete && current.creditId)
      await refundConsumedCredits({
        userId: current.userId,
        creditId: current.creditId,
        tx,
      });
    for (const task of tasks) {
      await tx
        .delete(tattooGeneration)
        .where(
          and(
            eq(tattooGeneration.projectId, current.projectId),
            eq(tattooGeneration.bodyPart, task.bodyPart)
          )
        );
      await tx.insert(tattooGeneration).values({
        id: randomUUID(),
        projectId: current.projectId,
        bodyPart: task.bodyPart,
        status:
          task.status === 'completed' && task.r2Url ? 'completed' : 'failed',
        r2Key: task.r2Key || null,
        r2Url: task.r2Url || null,
        error:
          task.error ||
          (task.status !== 'completed' ? 'Generation incomplete' : null),
      });
    }
    const status = successful.length ? 'completed' : 'failed';
    await tx
      .update(tattooProject)
      .set({ status })
      .where(eq(tattooProject.id, current.projectId));
    await tx
      .update(tattooJob)
      .set({
        stage: status,
        refunded: current.refunded || (incomplete && !!current.creditId),
        error: incomplete
          ? current.error || 'Some previews could not be generated.'
          : null,
      })
      .where(eq(tattooJob.projectId, current.projectId));
  });
}

// Explicit recovery only re-queries saved provider IDs; it never creates or charges a task.
export async function recoverSubmittedTattooJob(
  projectId: string,
  userId: string
): Promise<boolean> {
  return db().transaction(async (tx) => {
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, userId))
      .for('no key update');
    const [job] = await tx
      .select()
      .from(tattooJob)
      .where(
        and(eq(tattooJob.projectId, projectId), eq(tattooJob.userId, userId))
      )
      .for('update');
    if (!job || ACTIVE_STAGES.includes(job.stage)) return false;
    const tasks: Task[] = JSON.parse(job.tasks);
    const hasBodyWork = tasks.some(
      (task) => task.taskId && task.status !== 'completed'
    );
    const [project] = await tx
      .select({ designUrl: tattooProject.tattooDesignUrl })
      .from(tattooProject)
      .where(eq(tattooProject.id, projectId));
    const hasDesignWork =
      !!job.designTaskId &&
      job.designTaskId !== 'submitting' &&
      !project?.designUrl;
    if (!hasBodyWork && !hasDesignWork) return false;
    for (const task of tasks) {
      if (task.taskId && task.status !== 'completed') {
        task.status = 'running';
        delete task.error;
      } else if (!task.taskId && task.status !== 'completed')
        task.status = 'failed';
    }
    await tx
      .update(tattooJob)
      .set({
        stage: hasBodyWork ? 'fusion' : 'design',
        tasks: JSON.stringify(tasks),
        error: null,
        workflowRunId: null,
        workflowCheckedAt: null,
        leaseToken: null,
        leaseUntil: new Date(0),
        nextRunAt: new Date(),
        expiresAt: hasBodyWork ? new Date(Date.now() + 120_000) : new Date(0),
      })
      .where(eq(tattooJob.projectId, projectId));
    await tx
      .update(tattooProject)
      .set({ status: 'processing' })
      .where(eq(tattooProject.id, projectId));
    return true;
  });
}

export async function failUnstartedTattooJob(
  projectId: string
): Promise<boolean> {
  const snapshot = await getTattooJob(projectId);
  if (!snapshot) return false;
  return db().transaction(async (tx) => {
    await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, snapshot.userId))
      .for('no key update');
    const [job] = await tx
      .select()
      .from(tattooJob)
      .where(eq(tattooJob.projectId, projectId))
      .for('update');
    if (
      !job ||
      !ACTIVE_STAGES.includes(job.stage) ||
      job.designTaskId ||
      job.workflowRunId ||
      job.leaseUntil.getTime() > Date.now()
    )
      return false;
    if (job.creditId)
      await refundConsumedCredits({
        userId: job.userId,
        creditId: job.creditId,
        tx,
      });
    await tx
      .update(tattooProject)
      .set({ status: 'failed' })
      .where(eq(tattooProject.id, projectId));
    await tx
      .update(tattooJob)
      .set({
        stage: 'failed',
        refunded: !!job.creditId,
        error:
          'Background generation could not start. The generation charge has been reversed.',
      })
      .where(eq(tattooJob.projectId, projectId));
    return true;
  });
}

export async function advanceDueTattooJobs(limit = 5): Promise<number> {
  const now = new Date();
  const due = await db()
    .select({ id: tattooJob.projectId })
    .from(tattooJob)
    .where(
      and(
        inArray(tattooJob.stage, ACTIVE_STAGES),
        lte(tattooJob.nextRunAt, now),
        lte(tattooJob.leaseUntil, now)
      )
    )
    .orderBy(tattooJob.nextRunAt)
    .limit(limit);
  await Promise.allSettled(due.map((job) => advanceTattooJob(job.id)));
  return due.length;
}
