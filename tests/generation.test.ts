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
const start = (requestId = randomUUID(), resolution?: '1K' | '2K' | '4K') =>
  service.startTattooGeneration({
    actor: { type: 'user', id: userId },
    bodyPhotoKey: key(),
    prompt: 'A dragon',
    requestId,
    ip: '127.0.0.1',
    resolution,
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
    await mocks.database.insert(schema.user).values({
      id: userId,
      name: 'Test',
      email: 'generation@example.com',
      emailVerified: true,
    });
    await mocks.database.insert(schema.credit).values({
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
    mocks.record.mockReset().mockImplementation(async (id) => ({
      taskId: id,
      state: 'success',
      resultJson: JSON.stringify({
        resultUrls: [`https://ai.example/${id}.png`],
      }),
    }));
    mocks.upload.mockReset().mockImplementation(async (_source, key) => ({
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

  it('submits all four body tasks together after the design is ready', async () => {
    const id = await start();
    await tick(id);
    await tick(id);
    await tick(id);
    expect(mocks.create).toHaveBeenCalledTimes(5);
    const tasks = JSON.parse((await service.getTattooJob(id))!.tasks);
    expect(tasks.every((task: any) => task.status === 'running')).toBe(true);
  });

  it('reconciles already-generated body tasks after the deadline without reissuing or refunding them', async () => {
    const id = await start();
    for (let i = 0; i < 6; i++) await tick(id);
    expect(mocks.create).toHaveBeenCalledTimes(5);
    now += 21 * 60 * 1000;
    await tick(id);
    const results = await mocks.database.select().from(schema.tattooGeneration);
    expect(results.filter((r: any) => r.status === 'completed')).toHaveLength(
      4
    );
    expect(mocks.create).toHaveBeenCalledTimes(5);
    expect(await getRemainingCredits(userId)).toBe(2);
  });
  it('reverses an unstarted charge when background scheduling fails, exactly once', async () => {
    const id = await start(randomUUID(), '4K');
    expect(await getRemainingCredits(userId)).toBe(0);
    expect(await service.failUnstartedTattooJob(id)).toBe(true);
    expect(await getRemainingCredits(userId)).toBe(3);
    expect(await service.failUnstartedTattooJob(id)).toBe(false);
    expect(await getRemainingCredits(userId)).toBe(3);
    await tick(id);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('does not cancel or reverse an already-submitted provider task on a scheduler error', async () => {
    const id = await start();
    await tick(id);
    expect(await service.failUnstartedTattooJob(id)).toBe(false);
    expect(await getRemainingCredits(userId)).toBe(2);
  });

  it('recovers an old settled task from its existing provider ids without charging again or duplicating history rows', async () => {
    mocks.record.mockImplementation(async (id) =>
      id === 'design-task'
        ? {
            state: 'success',
            resultJson: JSON.stringify({
              resultUrls: ['https://ai.example/design.png'],
            }),
          }
        : { state: 'generating' }
    );
    const id = await start();
    await tick(id);
    await tick(id);
    await tick(id);
    now += 21 * 60 * 1000;
    await tick(id);
    expect(await getRemainingCredits(userId)).toBe(3);
    expect((await service.getTattooJob(id))?.stage).toBe('failed');
    expect(await service.recoverSubmittedTattooJob(id, 'another-user')).toBe(
      false
    );
    mocks.record.mockImplementation(async (taskId) => ({
      state: 'success',
      resultJson: JSON.stringify({
        resultUrls: [`https://ai.example/${taskId}.png`],
      }),
    }));
    expect(await service.recoverSubmittedTattooJob(id, userId)).toBe(true);
    await finish(id);
    const results = await mocks.database.select().from(schema.tattooGeneration);
    expect(results).toHaveLength(4);
    expect(results.every((row: any) => row.status === 'completed')).toBe(true);
    expect(await getRemainingCredits(userId)).toBe(3);
    expect((await service.getTattooJob(id))?.refunded).toBe(true);
    expect(mocks.create).toHaveBeenCalledTimes(5);
  });

  it('recovers a design-only expired job without submitting new body work or recharging', async () => {
    mocks.record.mockResolvedValue({ state: 'generating' });
    const id = await start();
    await tick(id);
    now += 21 * 60 * 1000;
    await tick(id);
    expect(await getRemainingCredits(userId)).toBe(3);
    mocks.record.mockResolvedValue({
      state: 'success',
      resultJson: JSON.stringify({
        resultUrls: ['https://ai.example/design.png'],
      }),
    });
    expect(await service.recoverSubmittedTattooJob(id, userId)).toBe(true);
    await finish(id);
    const [project] = await mocks.database
      .select()
      .from(schema.tattooProject)
      .where(eq(schema.tattooProject.id, id));
    expect(project.tattooDesignUrl).toContain('design.png');
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(await getRemainingCredits(userId)).toBe(3);
    expect((await service.getTattooJob(id))?.refunded).toBe(true);
  });

  it('rejects guests at the transactional service boundary before creating anything', async () => {
    const actor = { type: 'guest' as const, id: `guest_${randomUUID()}` };
    const params = () => ({
      actor,
      bodyPhotoKey: `uploads/${actor.id}/${randomUUID()}.png`,
      prompt: 'Dragon',
      requestId: randomUUID(),
      ip: '127.0.0.1',
    });
    await expect(service.startTattooGeneration(params())).rejects.toThrow(
      /Sign in/
    );
    expect(
      await mocks.database.select().from(schema.tattooProject)
    ).toHaveLength(0);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(await getRemainingCredits(actor.id)).toBe(0);
    expect(
      await mocks.database
        .select()
        .from(schema.credit)
        .where(eq(schema.credit.userId, actor.id))
    ).toHaveLength(0);
  });

  it('blocks unverified database users even if a caller claims a user actor', async () => {
    await mocks.database
      .update(schema.user)
      .set({ emailVerified: false })
      .where(eq(schema.user.id, userId));
    await expect(start()).rejects.toThrow(/Verify/);
    expect(await getRemainingCredits(userId)).toBe(3);
  });
  for (const [resolution, cost] of [
    ['1K', 1],
    ['2K', 2],
    ['4K', 3],
  ] as const) {
    it(`persists ${resolution}/${cost} credits and uses it for all five provider images`, async () => {
      const id = await start(randomUUID(), resolution);
      expect(await getRemainingCredits(userId)).toBe(3 - cost);
      await finish(id);
      const project = (
        await mocks.database
          .select()
          .from(schema.tattooProject)
          .where(eq(schema.tattooProject.id, id))
      )[0];
      expect(project.resolution).toBe(resolution);
      expect(project.creditsCost).toBe(cost);
      expect(mocks.create).toHaveBeenCalledTimes(5);
      for (const [body] of mocks.create.mock.calls)
        expect(body.input.resolution).toBe(resolution);
    });
    it(`returns the original ${cost}-credit charge on ${resolution} failure only once`, async () => {
      mocks.record.mockResolvedValue({
        state: 'failed',
        failMsg: 'Provider failed',
      });
      const id = await start(randomUUID(), resolution);
      expect(await getRemainingCredits(userId)).toBe(3 - cost);
      await finish(id);
      expect(await getRemainingCredits(userId)).toBe(3);
      await tick(id);
      expect(await getRemainingCredits(userId)).toBe(3);
    });
  }
  it('rejects resolution changes under the same request id without a second debit', async () => {
    const params = {
      actor: { type: 'user' as const, id: userId },
      bodyPhotoKey: key(),
      prompt: 'Wolf',
      requestId: randomUUID(),
      ip: '127.0.0.1',
      resolution: '2K' as const,
    };
    const id = await service.startTattooGeneration(params);
    expect(await service.startTattooGeneration(params)).toBe(id);
    await expect(
      service.startTattooGeneration({ ...params, resolution: '4K' })
    ).rejects.toThrow(/Request ID/);
    expect(await getRemainingCredits(userId)).toBe(1);
  });
  it('rejects unsupported resolutions and insufficient 4K balance before creating a project or provider call', async () => {
    const params = {
      actor: { type: 'user' as const, id: userId },
      bodyPhotoKey: key(),
      prompt: 'Wolf',
      requestId: randomUUID(),
      ip: '127.0.0.1',
    };
    await expect(
      service.startTattooGeneration({ ...params, resolution: '8K' as any })
    ).rejects.toThrow(/resolution/i);
    await mocks.database.update(schema.credit).set({ remainingCredits: 2 });
    await expect(
      service.startTattooGeneration({ ...params, resolution: '4K' })
    ).rejects.toThrow(/Insufficient/);
    expect(await getRemainingCredits(userId)).toBe(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(
      await mocks.database.select().from(schema.tattooProject)
    ).toHaveLength(0);
  });
});
