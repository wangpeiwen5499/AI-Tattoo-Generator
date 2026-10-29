import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { tattooProject, user } from '@/config/db/schema';

import { createTestDatabase } from './database';

const state = vi.hoisted(() => ({ database: null as any }));
vi.mock('@/core/db', () => ({ db: () => state.database }));
let close: () => Promise<void>;
beforeAll(async () => {
  const test = await createTestDatabase();
  state.database = test.database;
  close = () => test.client.close();
  await state.database
    .insert(user)
    .values({ id: 'history-user', name: 'Test', email: 'history@example.com' });
  await state.database
    .insert(tattooProject)
    .values(
      Array.from({ length: 25 }, (_, i) => ({
        id: randomUUID(),
        userId: 'history-user',
        prompt: `Project ${i}`,
        bodyPhotoKey: 'photo',
        bodyPhotoUrl: 'https://example.com/photo',
        createdAt: new Date(1000 * i),
      }))
    );
});
afterAll(async () => close?.());
it('bounds history pages and keeps user results ordered', async () => {
  const { listUserTattooProjects } = await import('@/server/db/tattoo-queries');
  const page = await listUserTattooProjects('history-user', {
    page: 2,
    limit: 20,
  });
  expect(page).toHaveLength(5);
  expect(page[0].prompt).toBe('Project 4');
});
