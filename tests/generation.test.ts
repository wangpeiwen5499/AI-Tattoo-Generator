import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import * as schema from '@/config/db/schema';
import { getRemainingCredits } from '@/shared/models/credit';

import { createTestDatabase } from './database';

const mocks = vi.hoisted(() => ({
  database: null as any,
  create: vi.fn(),
  record: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('@/core/db', () => ({ db: () => mocks.database }));
vi.mock('@/shared/models/user', () => ({
  appendUserToResult: (x: unknown) => x,
}));
vi.mock('@/shared/models/config', () => ({ getAllConfigs: () => ({}) }));
vi.mock('@/server/ai/kie-client', () => ({
  createTask: mocks.create,
  getRecordInfo: mocks.record,
}));
vi.mock('@/lib/r2', () => ({
  getPublicUrl: (key: string) => `https://storage.example/${key}`,
  fetchUrlAndUpload: mocks.upload,
}));

let close: () => Promise<void>;
let now = Date.now();
let service: typeof import('@/server/ai/tattoo-jobs');
const userId = 'generation-test-user';
const key = () => `uploads/${userId}/${randomUUID()}.png`;
const start = (requestId = randomUUID()) =>
  service.startTattooGeneration({
    actor: { type: 'user', id: userId },
    bodyPhotoKey: key(),
    prompt: 'A dragon',
    requestId,
    ip: '127.0.0.1',
  });
async function tick(id: string) {
  now += 4000;
  vi.setSystemTime(now);
  await service.advanceTattooJob(id);
}
async function finish(id: string) {
  for (let i = 0; i < 20; i++) await tick(id);
}

describe('durable tattoo jobs', () => {
  beforeAll(async () => {
    const test = await createTestDatabase();
    mocks.database = test.database;
    close = () => test.client.close();
    service = await import('@/server/ai/tattoo-jobs');
  });
  afterAll(async () => close?.());
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    now = Date.now();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    await mocks.database.delete(schema.user);
    await mocks.database.delete(schema.guestFreeUsage);
    await mocks.database
      .insert(schema.user)
      .values({ id: userId, name: 'Test', email: 'generation@example.com' });
    await mocks.database
      .insert(schema.credit)
      .values({
        id: randomUUID(),
        userId,
        transactionNo: randomUUID(),
        transactionType: 'grant',
        credits: 3,
        remainingCredits: 3,
        status: 'active',
      });
    mocks.create
      .mockReset()
      .mockImplementation(async (body) =>
        body.model.includes('text-to-image')
          ? 'design-task'
          : `fusion-${mocks.create.mock.calls.length}`
      );
    mocks.record
      .mockReset()
      .mockImplementation(async (id) => ({
        taskId: id,
        state: 'success',
        resultJson: JSON.stringify({
          resultUrls: [`https://ai.example/${id}.png`],
        }),
      }));
    mocks.upload
      .mockReset()
      .mockImplementation(async (_source, key) => ({
        key,
        publicUrl: `https://storage.example/${key}`,
      }));
  });

  it('creates and debits once for a retried start request', async () => {
    const params = {
      actor: { type: 'user' as const, id: userId },
      bodyPhotoKey: key(),
      prompt: 'Dragon',
      requestId: randomUUID(),
      ip: '127.0.0.1',
    };
    const first = await service.startTattooGeneration(params);
    expect(await service.startTattooGeneration(params)).toBe(first);
    expect(await getRemainingCredits(userId)).toBe(2);
    await expect(start()).rejects.toThrow(/progress/);
  });

  it('persists task ids, resumes and completes four outputs without duplicate AI creation', async () => {
    const id = await start();
    await Promise.all([tick(id), service.advanceTattooJob(id)]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    await finish(id);
    const project = (
      await mocks.database
        .select()
        .from(schema.tattooProject)
        .where(eq(schema.tattooProject.id, id))
    )[0];
    expect(project.status).toBe('completed');
    expect(
      await mocks.database.select().from(schema.tattooGeneration)
    ).toHaveLength(4);
    expect(mocks.create).toHaveBeenCalledTimes(5);
    expect(await getRemainingCredits(userId)).toBe(2);
  });

  it('preserves partial results and refunds the paid credit exactly once', async () => {
    mocks.record.mockImplementation(async (id) =>
      id === 'fusion-2'
        ? { state: 'failed', failMsg: 'Provider rejected image' }
        : {
            state: 'success',
            resultJson: JSON.stringify({
              resultUrls: [`https://ai.example/${id}.png`],
            }),
          }
    );
    const id = await start();
    await finish(id);
    expect(await getRemainingCredits(userId)).toBe(3);
    const job = await service.getTattooJob(id);
    expect(job?.refunded).toBe(true);
    expect(job?.stage).toBe('completed');
    expect(
      (await mocks.database.select().from(schema.tattooGeneration)).filter(
        (g: any) => g.status === 'completed'
      )
    ).toHaveLength(3);
    await tick(id);
    expect(await getRemainingCredits(userId)).toBe(3);
  });

  it('does not repeat an ambiguous provider creation after a process interruption', async () => {
    const id = await start();
    await mocks.database
      .update(schema.tattooJob)
      .set({ designTaskId: 'submitting' })
      .where(eq(schema.tattooJob.projectId, id));
    await tick(id);
    expect(mocks.create).not.toHaveBeenCalled();
    expect((await service.getTattooJob(id))?.stage).toBe('failed');
    expect(await getRemainingCredits(userId)).toBe(3);
  });

  it('ends expired jobs and refunds without issuing new provider tasks', async () => {
    const id = await start();
    now += 21 * 60 * 1000;
    await tick(id);
    expect((await service.getTattooJob(id))?.stage).toBe('failed');
    expect(await getRemainingCredits(userId)).toBe(3);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('collects other completed previews when one provider status repeatedly errors', async () => {
    mocks.record.mockImplementation(async (id) => {
      if (id === 'fusion-2') throw new Error('Temporary status failure');
      return {
        state: 'success',
        resultJson: JSON.stringify({
          resultUrls: [`https://ai.example/${id}.png`],
        }),
      };
    });
    const id = await start();
    await finish(id);
    now += 21 * 60 * 1000;
    await tick(id);
    const results = await mocks.database.select().from(schema.tattooGeneration);
    expect(
      results.filter((result: any) => result.status === 'completed')
    ).toHaveLength(3);
    expect(await getRemainingCredits(userId)).toBe(3);
  });

  it('does not refund free guest generations and atomically limits daily guest usage', async () => {
    mocks.create.mockRejectedValue(new Error('Provider unavailable'));
    const actor = { type: 'guest' as const, id: `guest_${randomUUID()}` };
    const params = () => ({
      actor,
      bodyPhotoKey: `uploads/${actor.id}/${randomUUID()}.png`,
      prompt: 'Dragon',
      requestId: randomUUID(),
      ip: '127.0.0.1',
    });
    for (let i = 0; i < 3; i++) {
      const id = await service.startTattooGeneration(params());
      await finish(id);
      expect((await service.getTattooJob(id))?.refunded).toBe(false);
    }
    await expect(service.startTattooGeneration(params())).rejects.toThrow(
      /limit/
    );
    expect(await getRemainingCredits(actor.id)).toBe(0);
    expect(
      await mocks.database
        .select()
        .from(schema.credit)
        .where(eq(schema.credit.userId, actor.id))
    ).toHaveLength(0);
  });
});
