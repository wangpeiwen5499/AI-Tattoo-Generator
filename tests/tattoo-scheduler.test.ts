import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import * as schema from '@/config/db/schema';

import { createTestDatabase } from './database';

const mocks = vi.hoisted(() => ({
  database: null as any,
  start: vi.fn(),
  status: vi.fn(),
}));
vi.mock('@/core/db', () => ({ db: () => mocks.database }));
vi.mock('workflow/api', () => ({
  start: mocks.start,
  getRun: () => ({
    get status() {
      return mocks.status();
    },
  }),
}));
let close: () => Promise<void>;
let ensure: typeof import('@/server/ai/tattoo-scheduler').ensureTattooWorkflow;
let projectId: string;
beforeAll(async () => {
  const test = await createTestDatabase();
  mocks.database = test.database;
  close = () => test.client.close();
  ensure = (await import('@/server/ai/tattoo-scheduler')).ensureTattooWorkflow;
});
afterAll(async () => close());
beforeEach(async () => {
  await mocks.database.delete(schema.user);
  await mocks.database
    .insert(schema.user)
    .values({
      id: 'runner-user',
      name: 'Runner',
      email: 'runner@example.com',
      emailVerified: true,
    });
  projectId = randomUUID();
  await mocks.database
    .insert(schema.tattooProject)
    .values({
      id: projectId,
      userId: 'runner-user',
      prompt: 'Wolf',
      bodyPhotoKey: 'uploads/runner-user/photo.png',
      bodyPhotoUrl: 'https://files.example/photo.png',
    });
  await mocks.database
    .insert(schema.tattooJob)
    .values({
      projectId,
      userId: 'runner-user',
      requestId: randomUUID(),
      expiresAt: new Date(Date.now() + 1200000),
    });
  mocks.start.mockReset().mockResolvedValue({ runId: 'run-1' });
  mocks.status.mockReset().mockResolvedValue('running');
});
it('enqueues once and preserves the saved run across repeated page visits', async () => {
  await ensure(projectId);
  await ensure(projectId);
  expect(mocks.start).toHaveBeenCalledTimes(1);
  const [job] = await mocks.database.select().from(schema.tattooJob);
  expect(job.workflowRunId).toBe('run-1');
});
it('recovers a failed workflow without re-creating or charging a generation', async () => {
  await ensure(projectId);
  await mocks.database
    .update(schema.tattooJob)
    .set({ workflowCheckedAt: new Date(0) });
  mocks.status.mockResolvedValue('failed');
  mocks.start.mockResolvedValue({ runId: 'run-2' });
  await ensure(projectId);
  expect(mocks.start).toHaveBeenCalledTimes(2);
  expect(await mocks.database.select().from(schema.tattooProject)).toHaveLength(
    1
  );
  expect(await mocks.database.select().from(schema.credit)).toHaveLength(0);
});
it('does not enqueue terminal jobs or create duplicate runs on status network failure', async () => {
  await ensure(projectId);
  await mocks.database
    .update(schema.tattooJob)
    .set({ workflowCheckedAt: new Date(0) });
  mocks.status.mockRejectedValue(new Error('Network unavailable'));
  await expect(ensure(projectId)).rejects.toThrow('Network unavailable');
  expect(mocks.start).toHaveBeenCalledTimes(1);
  await mocks.database
    .update(schema.tattooJob)
    .set({ stage: 'completed' })
    .where(eq(schema.tattooJob.projectId, projectId));
  await ensure(projectId);
  expect(mocks.start).toHaveBeenCalledTimes(1);
});
