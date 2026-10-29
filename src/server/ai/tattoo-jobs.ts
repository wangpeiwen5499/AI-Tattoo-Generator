import { randomUUID } from 'node:crypto';
import {
  BODY_PART_LABELS,
  BODY_PARTS,
  CREDITS_PER_GENERATION,
  type BodyPart,
} from '@/lib/constants';
import { fetchUrlAndUpload, getPublicUrl } from '@/lib/r2';
import type { Actor } from '@/server/auth/actor';
import { claimGuestFree, ensureGuestUser } from '@/server/db/guest-queries';
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
}): Promise<string> {
  const { actor, bodyPhotoKey, prompt, requestId, ip } = input;
  if (!isOwnedUploadKey(bodyPhotoKey, actor.id))
    throw new GenerationRequestError('Invalid photo ownership');
  if (
    !prompt.trim() ||
    prompt.length > 500 ||
    !/^[0-9a-f-]{36}$/i.test(requestId)
  )
    throw new GenerationRequestError('Invalid generation request');
  return db().transaction(async (tx) => {
    if (actor.type === 'guest') await ensureGuestUser(actor.id, tx);
    const [owner] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, actor.id))
      .for('no key update');
    if (!owner) throw new GenerationRequestError('User not found', 401);
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
        project.prompt !== prompt.trim()
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
    let creditId: string | null = null;
    if (actor.type === 'guest') {
      if ((await claimGuestFree(ip, tx)) < 0)
        throw new GenerationRequestError(
          'Daily guest limit reached. Sign up for more previews.',
          429
        );
    } else {
      try {
        creditId = (
          await consumeCredits({
            userId: actor.id,
            credits: CREDITS_PER_GENERATION,
            scene: 'tattoo',
            description: 'Tattoo preview',
            tx,
          })
        ).id;
      } catch (error) {
        if (error instanceof Error && error.message.includes('Insufficient'))
          throw new GenerationRequestError('Insufficient credits', 402);
        throw error;
      }
    }
    const projectId = randomUUID();
    await tx
      .insert(tattooProject)
      .values({
        id: projectId,
        userId: actor.id,
        bodyPhotoKey,
        bodyPhotoUrl: getPublicUrl(bodyPhotoKey),
        prompt: prompt.trim(),
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
      expiresAt: new Date(Date.now() + JOB_TIMEOUT_MS),
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
      .set(changes)
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
    if (job.stage === 'finalizing' || job.expiresAt.getTime() <= Date.now()) {
      await save({
        stage: 'finalizing',
        error: job.error || 'Generation timed out. Please try again.',
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
            `outputs/${job.userId}/${projectId}/design.png`
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
    const pending = tasks.find(
      (task) => task.status === 'pending' || task.status === 'submitting'
    );
    if (pending) {
      if (pending.status === 'submitting') {
        pending.status = 'failed';
        pending.error = 'Provider submission was interrupted';
      } else {
        pending.status = 'submitting';
        await save({ tasks: JSON.stringify(tasks) });
        try {
          pending.taskId = await createTask({
            model: 'gpt-image-2-image-to-image',
            input: {
              prompt: `Apply this tattoo design naturally on the ${BODY_PART_LABELS[pending.bodyPart].toLowerCase()} of the person in the photo. Make it look real with natural skin texture, lighting, perspective, and body contour. Do not change anything else in the photo.`,
              input_urls: [project.bodyPhotoUrl, project.tattooDesignUrl!],
              aspect_ratio: '3:4',
            },
          });
          pending.status = 'running';
        } catch {
          pending.status = 'failed';
          pending.error = 'Unable to submit body preview';
        }
      }
      await save({ tasks: JSON.stringify(tasks) });
      return;
    }
    const running = tasks
      .filter((task) => task.status === 'running')
      .sort((a, b) => (a.checkedAt || 0) - (b.checkedAt || 0))[0];
    if (running) {
      running.checkedAt = Date.now();
      // Persist the attempt before fallible I/O so one broken task cannot starve its siblings.
      await save({ tasks: JSON.stringify(tasks) });
      const info = await getRecordInfo(running.taskId!);
      if (info.state === 'failed' || info.state === 'fail') {
        running.status = 'failed';
        running.error = 'Body preview failed';
      } else if (info.state === 'success') {
        const stored = await fetchUrlAndUpload(
          resultUrl(info.resultJson),
          `outputs/${job.userId}/${projectId}/${running.bodyPart}.png`
        );
        running.status = 'completed';
        running.r2Key = stored.key;
        running.r2Url = stored.publicUrl;
      }
      await save({ tasks: JSON.stringify(tasks) });
      if (tasks.some((task) => task.status === 'running')) return;
    }
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
        refunded: incomplete && !!current.creditId,
        error: incomplete
          ? current.error || 'Some previews could not be generated.'
          : null,
      })
      .where(eq(tattooJob.projectId, current.projectId));
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
