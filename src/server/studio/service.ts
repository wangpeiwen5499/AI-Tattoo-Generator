import { randomUUID } from 'node:crypto';
import { fetchUrlAndUpload, getPublicUrl } from '@/lib/r2';
import { parseTattooResolution } from '@/lib/tattoo-resolution';
import { and, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

import { db } from '@/core/db';
import { studioAsset, studioJob, studioRecord, user } from '@/config/db/schema';
import { consumeCredits, refundConsumedCredits } from '@/shared/models/credit';

import { ownedAsset, providerResultUrl } from './assets';
import {
  assertStudioProduction,
  placementPrompt,
  StudioError,
  validateStudioInput,
} from './policy';
import { createTask, getRecordInfo } from './provider';

export const ACTIVE = ['queued', 'submitting', 'running', 'storing'];
export async function getStudioJob(userId: string, id: string) {
  const [job] = await db()
    .select()
    .from(studioJob)
    .where(and(eq(studioJob.id, id), eq(studioJob.userId, userId)));
  if (!job) throw new StudioError('Job not found', 404);
  return job;
}
export async function startStudioJob(
  userId: string,
  kind: 'design' | 'render',
  raw: unknown
) {
  assertStudioProduction();
  const { input, resolution, credits } = validateStudioInput(kind, raw);
  return db().transaction(async (tx) => {
    // Serialize even cross-account attempts at the same globally unique operation
    // before checking it, so collisions consistently return 409 without a debit.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${'studio-operation:' + input.operationId}, 0))`
    );
    const [owner] = await tx
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .for('no key update');
    if (!owner?.emailVerified)
      throw new StudioError('Verify your email before using credits.', 403);
    const [existing] = await tx
      .select()
      .from(studioJob)
      .where(eq(studioJob.operationId, input.operationId));
    const serialized = JSON.stringify(input);
    if (existing) {
      if (
        existing.userId !== userId ||
        existing.kind !== kind ||
        existing.input !== serialized
      )
        throw new StudioError('Operation ID already used', 409);
      return existing.id;
    }
    if ('photo' in input) {
      for (const id of [input.photo, input.design, input.guide])
        await ownedAsset(userId, id, tx as any);
      if (input.designId) {
        const [record] = await tx
          .select()
          .from(studioRecord)
          .where(
            and(
              eq(studioRecord.id, input.designId),
              eq(studioRecord.userId, userId),
              eq(studioRecord.collection, 'designs'),
              isNull(studioRecord.deletedAt)
            )
          );
        if (!record || record.image !== input.design)
          throw new StudioError('Design not found', 404);
      }
    }
    const [active] = await tx
      .select({ id: studioJob.id })
      .from(studioJob)
      .where(
        and(
          eq(studioJob.userId, userId),
          inArray(studioJob.state, [...ACTIVE, 'review_required'])
        )
      )
      .limit(1);
    if (active)
      throw new StudioError(
        'Resume the current job before starting another.',
        409
      );
    let creditId: string;
    try {
      creditId = (
        await consumeCredits({
          userId,
          credits,
          scene: 'studio',
          description: `Tattoo ${kind} (${resolution})`,
          metadata: JSON.stringify({
            operationId: input.operationId,
            kind,
            resolution,
          }),
          tx,
        })
      ).id;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Insufficient'))
        throw new StudioError('Insufficient credits', 402);
      throw error;
    }
    const id = randomUUID();
    await tx.insert(studioJob).values({
      id,
      userId,
      kind,
      operationId: input.operationId,
      input: serialized,
      resolution,
      creditId,
      leaseUntil: new Date(0),
    });
    return id;
  });
}
export async function studioCollection(userId: string, collection: string) {
  if (!['designs', 'history'].includes(collection))
    throw new StudioError('Invalid collection');
  return db()
    .select()
    .from(studioRecord)
    .where(
      and(
        eq(studioRecord.userId, userId),
        eq(studioRecord.collection, collection),
        isNull(studioRecord.deletedAt)
      )
    )
    .orderBy(desc(studioRecord.createdAt))
    .limit(500);
}
export async function removeStudioRecord(
  userId: string,
  collection: string,
  id: string
) {
  if (!['designs', 'history'].includes(collection))
    throw new StudioError('Invalid collection');
  const rows = await db()
    .update(studioRecord)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(studioRecord.id, id),
        eq(studioRecord.userId, userId),
        eq(studioRecord.collection, collection)
      )
    )
    .returning({ id: studioRecord.id });
  if (!rows.length) throw new StudioError('Record not found', 404);
}

// The lease serializes status/workflow requests; the persisted submitting marker prevents
// reissuing a paid create even after process death or lease expiration.
export async function advanceStudioJob(id: string) {
  assertStudioProduction();
  const token = randomUUID(),
    now = new Date();
  const [job] = await db()
    .update(studioJob)
    .set({ leaseToken: token, leaseUntil: new Date(Date.now() + 120_000) })
    .where(
      and(
        eq(studioJob.id, id),
        inArray(studioJob.state, ACTIVE),
        lte(studioJob.leaseUntil, now),
        lte(studioJob.nextRunAt, now)
      )
    )
    .returning();
  if (!job) return;
  const save = async (changes: Partial<typeof studioJob.$inferInsert>) => {
    const rows = await db()
      .update(studioJob)
      .set(changes)
      .where(and(eq(studioJob.id, id), eq(studioJob.leaseToken, token)))
      .returning();
    if (!rows.length) throw new Error('Studio lease lost');
  };
  try {
    if (job.deadlineAt.getTime() <= Date.now()) {
      await save({
        state: 'review_required',
        error:
          'This image needs support review after a prolonged provider or storage delay. Your credit is held and existing provider work is preserved.',
      });
      return;
    }
    const input = JSON.parse(job.input);
    if (job.state === 'submitting') {
      await save({
        state: 'review_required',
        error:
          'Provider submission was interrupted. Support must review this held credit before another request.',
      });
      return;
    }
    if (job.state === 'queued') {
      let urls: string[] | undefined;
      if (job.kind === 'render') {
        urls = [];
        for (const asset of [input.photo, input.design, input.guide])
          urls.push(getPublicUrl((await ownedAsset(job.userId, asset)).key));
      }
      await save({ state: 'submitting' });
      let taskId: string;
      try {
        taskId = await createTask({
          model:
            job.kind === 'design'
              ? 'gpt-image-2-text-to-image'
              : 'gpt-image-2-image-to-image',
          input: {
            prompt:
              job.kind === 'design'
                ? `${input.prompt}. Professional tattoo flash design, clean bold lines, white background, no text.`
                : placementPrompt(input.region),
            ...(urls ? { input_urls: urls } : {}),
            resolution: parseTattooResolution(job.resolution),
            aspect_ratio: job.kind === 'design' ? '1:1' : 'auto',
          },
        });
      } catch {
        // Network errors, malformed replies and HTTP errors may hide accepted work.
        await save({
          state: 'review_required',
          error:
            'Provider submission was not confirmed. Your credit is held for review; no automatic retry will be made.',
        });
        return;
      }
      await save({ providerTaskId: taskId, state: 'running' });
      return;
    }
    let source = job.resultUrl;
    if (job.state === 'running') {
      if (!job.providerTaskId) throw new Error('Missing provider task');
      const info = await getRecordInfo(job.providerTaskId);
      if (['failed', 'fail'].includes(info.state)) {
        await db().transaction(async (tx) => {
          await tx
            .select({ id: user.id })
            .from(user)
            .where(eq(user.id, job.userId))
            .for('no key update');
          const [current] = await tx
            .select()
            .from(studioJob)
            .where(eq(studioJob.id, id))
            .for('update');
          if (current?.leaseToken !== token || current.state !== 'running')
            return;
          await refundConsumedCredits({
            userId: job.userId,
            creditId: job.creditId,
            tx,
          });
          await tx
            .update(studioJob)
            .set({
              state: 'failed',
              refunded: true,
              error:
                'The AI provider could not complete this image. Credits were restored.',
            })
            .where(eq(studioJob.id, id));
        });
        return;
      }
      if (info.state !== 'success') return;
      source = providerResultUrl(info.resultJson);
      await save({ resultUrl: source, state: 'storing' });
    }
    if (!source) throw new Error('Missing result URL');
    const stored = await fetchUrlAndUpload(
      source,
      `outputs/${job.userId}/studio/${id}.png`,
      40 * 1024 * 1024,
      job.kind === 'design'
    );
    await db().transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(studioJob)
        .where(eq(studioJob.id, id))
        .for('update');
      if (current?.leaseToken !== token || current.state !== 'storing')
        throw new Error('Studio lease lost');
      const assetId = randomUUID(),
        recordId = randomUUID();
      await tx.insert(studioAsset).values({
        id: assetId,
        userId: job.userId,
        key: stored.key,
        contentType: stored.contentType,
      });
      await tx.insert(studioRecord).values({
        id: recordId,
        userId: job.userId,
        collection: job.kind === 'design' ? 'designs' : 'history',
        operationId: job.operationId,
        prompt: input.prompt || '',
        source: 'generated',
        resolution: job.resolution,
        image: assetId,
        original: input.photo || null,
        draft: input.guide || null,
        designId: input.designId || null,
      });
      await tx
        .update(studioJob)
        .set({ state: 'success', assetId, recordId, error: null })
        .where(eq(studioJob.id, id));
    });
  } catch {
    /* Read/storage failures retain durable provider ID and retry without another create. */
  } finally {
    await db()
      .update(studioJob)
      .set({
        leaseToken: null,
        leaseUntil: new Date(0),
        nextRunAt: new Date(Date.now() + 3000),
      })
      .where(and(eq(studioJob.id, id), eq(studioJob.leaseToken, token)));
  }
}
