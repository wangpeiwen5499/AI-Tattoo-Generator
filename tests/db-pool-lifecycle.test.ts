import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  env: {
    database_url: 'postgres://test',
    db_schema: 'tenant',
    db_singleton_enabled: 'false',
    db_max_connections: '3',
  },
  worker: false,
  postgres: vi.fn(),
  drizzle: vi.fn(),
}));
vi.mock('@/config', () => ({ envConfigs: mocks.env }));
vi.mock('@/shared/lib/env', () => ({
  get isCloudflareWorker() {
    return mocks.worker;
  },
}));
vi.mock('postgres', () => ({ default: mocks.postgres }));
vi.mock('drizzle-orm/postgres-js', () => ({ drizzle: mocks.drizzle }));
beforeEach(() => {
  vi.resetModules();
  mocks.worker = false;
  mocks.env.db_singleton_enabled = 'false';
  mocks.postgres
    .mockReset()
    .mockImplementation(() => ({ end: vi.fn().mockResolvedValue(undefined) }));
  mocks.drizzle.mockReset().mockImplementation((input) => ({ input }));
});
it('reuses a bounded Node pool even with the default singleton flag disabled', async () => {
  const { db, closeDb } = await import('@/core/db');
  const first = db();
  for (let i = 0; i < 100; i++) expect(db()).toBe(first);
  expect(mocks.postgres).toHaveBeenCalledTimes(1);
  expect(mocks.postgres.mock.calls[0][1]).toMatchObject({
    max: 1,
    prepare: false,
    connection: { options: '-c search_path=tenant' },
  });
  const client = mocks.postgres.mock.results[0].value;
  await closeDb();
  expect(client.end).toHaveBeenCalledOnce();
  expect(db()).not.toBe(first);
});
it('honors explicitly configured Node pool size', async () => {
  mocks.env.db_singleton_enabled = 'true';
  const { db } = await import('@/core/db');
  db();
  db();
  expect(mocks.postgres).toHaveBeenCalledTimes(1);
  expect(mocks.postgres.mock.calls[0][1].max).toBe(3);
});
it('does not reuse a client across Worker calls', async () => {
  mocks.worker = true;
  const { db, closeDb } = await import('@/core/db');
  db();
  db();
  await closeDb();
  expect(mocks.postgres).toHaveBeenCalledTimes(2);
  expect(mocks.postgres.mock.results[0].value.end).not.toHaveBeenCalled();
});
