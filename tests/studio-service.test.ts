import { randomUUID } from 'node:crypto';
import { ownedAsset, uploadAsset } from '@/server/studio/assets';
import { resolveStudioReview } from '@/server/studio/recovery';
import { advanceDueStudioJobs } from '@/server/studio/runner';
import {
  advanceStudioJob,
  getStudioJob,
  removeStudioRecord,
  startStudioJob,
  studioCollection,
} from '@/server/studio/service';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  credit,
  studioAsset,
  studioJob,
  studioRecord,
  user,
} from '@/config/db/schema';
import { getRemainingCredits } from '@/shared/models/credit';

import { applyStudioUpgrade } from '../scripts/lib/studio-upgrade';
import { createTestDatabase } from './database';

const state = vi.hoisted(() => ({
  database: null as any,
  create: vi.fn(),
  info: vi.fn(),
  store: vi.fn(),
  uploadUrl: vi.fn(),
}));
vi.mock('@/core/db', () => ({ db: () => state.database }));
vi.mock('@/shared/models/user', () => ({
  appendUserToResult: (v: unknown) => v,
}));
vi.mock('@/shared/models/config', () => ({ getAllConfigs: () => ({}) }));
vi.mock('@/server/studio/provider', () => ({
  createTask: state.create,
  getRecordInfo: state.info,
}));
vi.mock('@/server/studio/scheduler', () => ({
  ensureStudioWorkflow: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/r2', () => ({
  getPublicUrl: (key: string) => `https://storage.example/${key}`,
  fetchUrlAndUpload: state.store,
  getUploadUrl: state.uploadUrl,
}));
let close: () => Promise<void>;
const userId = 'studio-owner',
  other = 'other-owner';
const request = () => ({ operationId: randomUUID(), prompt: 'rose' });
async function due(id: string) {
  await state.database
    .update(studioJob)
    .set({ nextRunAt: new Date(0), leaseUntil: new Date(0) })
    .where(eq(studioJob.id, id));
}
describe('account studio durable jobs', () => {
  beforeAll(async () => {
    const test = await createTestDatabase();
    state.database = test.database;
    close = () => test.client.close();
  });
  afterAll(async () => {
    await close?.();
    vi.unstubAllEnvs();
  });
  beforeEach(async () => {
    vi.unstubAllGlobals();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.clearAllMocks();
    await state.database.delete(studioJob);
    await state.database.delete(studioRecord);
    await state.database.delete(studioAsset);
    await state.database.delete(credit);
    await state.database.delete(user);
    await state.database.insert(user).values([
      {
        id: userId,
        email: 'owner@example.com',
        name: 'Owner',
        emailVerified: true,
      },
      {
        id: other,
        email: 'other@example.com',
        name: 'Other',
        emailVerified: true,
      },
    ]);
    await state.database.insert(credit).values({
      id: randomUUID(),
      userId,
      transactionNo: randomUUID(),
      transactionType: 'grant',
      transactionScene: 'payment',
      credits: 10,
      remainingCredits: 10,
      status: 'active',
    });
    state.create.mockResolvedValue('provider-task');
    state.info.mockResolvedValue({ state: 'running' });
    state.store.mockResolvedValue({
      key: 'output.png',
      contentType: 'image/png',
    });
  });
  it('parallel duplicate operation debits and creates only once', async () => {
    const input = request();
    const [a, b] = await Promise.all([
      startStudioJob(userId, 'design', input),
      startStudioJob(userId, 'design', input),
    ]);
    expect(a).toBe(b);
    expect(await getRemainingCredits(userId)).toBe(9);
    await Promise.all([advanceStudioJob(a), advanceStudioJob(a)]);
    expect(state.create).toHaveBeenCalledTimes(1);
    await expect(
      startStudioJob(userId, 'design', { ...input, prompt: 'changed' })
    ).rejects.toMatchObject({ status: 409 });
  });
  it('blocks cross-account jobs/assets/collections and unverified billing', async () => {
    const id = await startStudioJob(userId, 'design', request());
    await expect(getStudioJob(other, id)).rejects.toMatchObject({
      status: 404,
    });
    const assetId = randomUUID();
    await state.database.insert(studioAsset).values({
      id: assetId,
      userId,
      key: 'owned.png',
      contentType: 'image/png',
    });
    await expect(ownedAsset(other, assetId)).rejects.toMatchObject({
      status: 404,
    });
    const recordId = randomUUID();
    await state.database
      .insert(studioRecord)
      .values({ id: recordId, userId, collection: 'designs', image: assetId });
    expect(await studioCollection(other, 'designs')).toEqual([]);
    await expect(
      removeStudioRecord(other, 'designs', recordId)
    ).rejects.toMatchObject({ status: 404 });
    await state.database
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, other));
    await expect(
      startStudioJob(other, 'design', request())
    ).rejects.toMatchObject({ status: 403 });
  });
  it('holds ambiguous creates, never retries and permits one reviewed refund', async () => {
    const id = await startStudioJob(userId, 'design', request());
    state.create.mockRejectedValue(new Error('network timeout'));
    await advanceStudioJob(id);
    await due(id);
    await advanceStudioJob(id);
    expect((await getStudioJob(userId, id)).state).toBe('review_required');
    expect(await getRemainingCredits(userId)).toBe(9);
    expect(state.create).toHaveBeenCalledTimes(1);
    await resolveStudioReview('admin', id, 'refund');
    await resolveStudioReview('admin', id, 'refund');
    expect(await getRemainingCredits(userId)).toBe(10);
  });
  it('an interrupted submitting marker cannot create again', async () => {
    const id = await startStudioJob(userId, 'design', request());
    await state.database
      .update(studioJob)
      .set({ state: 'submitting' })
      .where(eq(studioJob.id, id));
    await advanceStudioJob(id);
    expect(state.create).not.toHaveBeenCalled();
    expect((await getStudioJob(userId, id)).state).toBe('review_required');
  });
  it('provider failure refunds original consumption once', async () => {
    const id = await startStudioJob(userId, 'design', request());
    await advanceStudioJob(id);
    await due(id);
    state.info.mockResolvedValue({ state: 'failed' });
    await Promise.all([advanceStudioJob(id), advanceStudioJob(id)]);
    await due(id);
    await advanceStudioJob(id);
    expect(await getRemainingCredits(userId)).toBe(10);
    expect((await getStudioJob(userId, id)).refunded).toBe(true);
  });
  it('storage retries without new provider calls and persists library before success', async () => {
    const id = await startStudioJob(userId, 'design', request());
    await advanceStudioJob(id);
    await due(id);
    state.info.mockResolvedValue({
      state: 'success',
      resultJson: JSON.stringify({
        resultUrls: ['https://tempfile.aiquickdraw.com/result.png'],
      }),
    });
    state.store.mockRejectedValueOnce(new Error('storage down'));
    await advanceStudioJob(id);
    expect((await getStudioJob(userId, id)).state).toBe('storing');
    expect(await studioCollection(userId, 'designs')).toHaveLength(0);
    await due(id);
    await advanceStudioJob(id);
    const job = await getStudioJob(userId, id);
    expect(job.state).toBe('success');
    expect(await studioCollection(userId, 'designs')).toMatchObject([
      { operationId: job.operationId, image: job.assetId },
    ]);
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(state.info).toHaveBeenCalledTimes(1);
    expect(await getRemainingCredits(userId)).toBe(9);
  });
  it('preview refuses all job advancement and writes', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    await expect(
      startStudioJob(userId, 'design', request())
    ).rejects.toMatchObject({ status: 503 });
    await expect(advanceStudioJob('anything')).rejects.toMatchObject({
      status: 503,
    });
    expect(await getRemainingCredits(userId)).toBe(10);
    expect(state.create).not.toHaveBeenCalled();
  });
  it('migration can repeat without changing existing balances', async () => {
    await applyStudioUpgrade(state.database, 'public');
    await applyStudioUpgrade(state.database, 'public');
    expect(await getRemainingCredits(userId)).toBe(10);
  });
  it('render checks ownership before debit and charges exactly selected resolution', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of ids)
      await state.database
        .insert(studioAsset)
        .values({ id, userId, key: `${id}.png`, contentType: 'image/png' });
    const input = {
      operationId: randomUUID(),
      photo: ids[0],
      design: ids[1],
      guide: ids[2],
      region: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
      resolution: '4K',
    };
    await expect(startStudioJob(other, 'render', input)).rejects.toMatchObject({
      status: 404,
    });
    expect(await getRemainingCredits(userId)).toBe(10);
    const id = await startStudioJob(userId, 'render', input);
    expect(await getRemainingCredits(userId)).toBe(7);
    await advanceStudioJob(id);
    expect(state.create.mock.calls[0][0]).toMatchObject({
      model: 'gpt-image-2-image-to-image',
      input: {
        resolution: '4K',
        input_urls: ids.map((id) => `https://storage.example/${id}.png`),
      },
    });
  });
  it('failed job never revives a purchase that was refunded separately', async () => {
    const id = await startStudioJob(userId, 'design', request());
    await advanceStudioJob(id);
    await state.database
      .update(credit)
      .set({ status: 'refunded', remainingCredits: 0 })
      .where(eq(credit.transactionType, 'grant'));
    await due(id);
    state.info.mockResolvedValue({ state: 'failed' });
    await advanceStudioJob(id);
    expect(await getRemainingCredits(userId)).toBe(0);
    const grants = await state.database
      .select()
      .from(credit)
      .where(eq(credit.transactionType, 'grant'));
    expect(grants[0].remainingCredits).toBe(0);
    expect(grants[0].status).toBe('refunded');
  });
  it('database finalization rollback retries storage without recreating a provider task', async () => {
    const id = await startStudioJob(userId, 'design', request());
    await advanceStudioJob(id);
    await due(id);
    state.info.mockResolvedValue({
      state: 'success',
      resultJson: JSON.stringify({
        resultUrls: ['https://tempfile.aiquickdraw.com/result.png'],
      }),
    });
    const transaction = state.database.transaction.bind(state.database);
    const spy = vi
      .spyOn(state.database, 'transaction')
      .mockRejectedValueOnce(new Error('database unavailable'));
    await advanceStudioJob(id);
    expect((await getStudioJob(userId, id)).state).toBe('storing');
    expect(await studioCollection(userId, 'designs')).toHaveLength(0);
    spy.mockImplementation(transaction);
    await due(id);
    await advanceStudioJob(id);
    spy.mockRestore();
    expect((await getStudioJob(userId, id)).state).toBe('success');
    expect(state.create).toHaveBeenCalledTimes(1);
    expect(await studioCollection(userId, 'designs')).toHaveLength(1);
  });
  it('cron fallback advances closed-browser jobs and excludes review holds', async () => {
    const id = await startStudioJob(userId, 'design', request());
    expect(await advanceDueStudioJobs()).toBe(1);
    expect(state.create).toHaveBeenCalledTimes(1);
    await state.database
      .update(studioJob)
      .set({ state: 'review_required' })
      .where(eq(studioJob.id, id));
    await due(id);
    expect(await advanceDueStudioJobs()).toBe(0);
    expect(state.create).toHaveBeenCalledTimes(1);
  });
  it.each(['running', 'storing'])(
    'moves a prolonged %s job to review preserving provider work and held credits',
    async (phase) => {
      const id = await startStudioJob(userId, 'design', request());
      await state.database
        .update(studioJob)
        .set({
          state: phase,
          providerTaskId: 'known-task',
          resultUrl:
            phase === 'storing'
              ? 'https://tempfile.aiquickdraw.com/result.png'
              : null,
          deadlineAt: new Date(0),
        })
        .where(eq(studioJob.id, id));
      await advanceStudioJob(id);
      const job = await getStudioJob(userId, id);
      expect(job.state).toBe('review_required');
      expect(job.providerTaskId).toBe('known-task');
      expect(job.refunded).toBe(false);
      expect(await getRemainingCredits(userId)).toBe(9);
      expect(state.create).not.toHaveBeenCalled();
      expect(state.info).not.toHaveBeenCalled();
      expect(state.store).not.toHaveBeenCalled();
      const recovered = await resolveStudioReview(
        'admin',
        id,
        'attach',
        'known-task'
      );
      expect(recovered.state).toBe(phase);
      expect(recovered.deadlineAt.getTime()).toBeGreaterThan(Date.now());
      state.info.mockResolvedValue({
        state: 'success',
        resultJson: JSON.stringify({
          resultUrls: ['https://tempfile.aiquickdraw.com/result.png'],
        }),
      });
      await due(id);
      await advanceStudioJob(id);
      expect((await getStudioJob(userId, id)).state).toBe('success');
      expect(state.create).not.toHaveBeenCalled();
      expect(state.info).toHaveBeenCalledTimes(phase === 'storing' ? 0 : 1);
      expect(await getRemainingCredits(userId)).toBe(9);
    }
  );
  it('limits verified-account uploads to100 per rolling day and rejects unverified uploads before storage', async () => {
    const sharp = (await import('sharp')).default;
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const file = new File([new Uint8Array(bytes)], 'image.png', {
      type: 'image/png',
    });
    await state.database
      .update(user)
      .set({ emailVerified: false })
      .where(eq(user.id, other));
    await expect(uploadAsset(other, file)).rejects.toMatchObject({
      status: 403,
    });
    expect(state.uploadUrl).not.toHaveBeenCalled();
    await state.database.insert(studioAsset).values(
      Array.from({ length: 100 }, (_, i) => ({
        id: randomUUID(),
        userId,
        key: `uploads/${userId}/studio-${i}.png`,
        contentType: 'image/png',
        createdAt: new Date(Date.now() - 10_000),
      }))
    );
    await expect(uploadAsset(userId, file)).rejects.toMatchObject({
      status: 429,
    });
    expect(state.uploadUrl).not.toHaveBeenCalled();
  });
  it('paces parallel uploads and counts them under one account lock', async () => {
    const sharp = (await import('sharp')).default;
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();
    const file = new File([new Uint8Array(bytes)], 'image.png', {
      type: 'image/png',
    });
    state.uploadUrl.mockResolvedValue({
      uploadUrl: 'https://storage.example/signed',
    });
    const times: number[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        times.push(Date.now());
        return new Response(null, { status: 200 });
      })
    );
    await Promise.all([uploadAsset(userId, file), uploadAsset(userId, file)]);
    expect(times).toHaveLength(2);
    expect(times[1] - times[0]).toBeGreaterThanOrEqual(900);
    expect(await state.database.select().from(studioAsset)).toHaveLength(2);
    vi.unstubAllGlobals();
  });
});
