import {
  renameStudioRecord,
  studioCollectionPage,
} from '@/server/studio/library';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';

import { studioAsset, studioRecord, user } from '@/config/db/schema';

import { createTestDatabase } from './database';

const state = vi.hoisted(() => ({ database: null as any }));
vi.mock('@/core/db', () => ({ db: () => state.database }));
let close: () => Promise<void>;
beforeAll(async () => {
  const test = await createTestDatabase();
  state.database = test.database;
  close = () => test.client.close();
  await state.database.insert(user).values([
    { id: 'library-owner', name: 'Owner', email: 'library@example.com' },
    { id: 'library-other', name: 'Other', email: 'other-library@example.com' },
  ]);
  await state.database
    .insert(studioAsset)
    .values({
      id: 'asset',
      userId: 'library-owner',
      key: 'test',
      contentType: 'image/png',
    });
  await state.database.insert(studioRecord).values(
    Array.from({ length: 505 }, (_, index) => ({
      id: `record-${String(index).padStart(4, '0')}`,
      userId: 'library-owner',
      collection: 'designs',
      image: 'asset',
      name: `Rose ${index}`,
      source: index % 2 ? 'uploaded' : 'generated',
    }))
  );
});
afterAll(async () => {
  await close?.();
});
it('pages beyond 500 records with total counts and stable ordering', async () => {
  const last = await studioCollectionPage('library-owner', 'designs', {
    page: '22',
  });
  expect(last.total).toBe(505);
  expect(last.records).toHaveLength(1);
  expect(last.page).toBe(22);
  expect((await studioCollectionPage('library-other', 'designs')).total).toBe(
    0
  );
});
it('renames only owned live records and validates printable names', async () => {
  await expect(
    renameStudioRecord('library-other', 'designs', 'record-0000', 'Stolen')
  ).rejects.toThrow('Record not found');
  await expect(
    renameStudioRecord('library-owner', 'designs', 'record-0000', ' ')
  ).rejects.toThrow('Name must');
  await expect(
    renameStudioRecord(
      'library-owner',
      'designs',
      'record-0000',
      'x'.repeat(101)
    )
  ).rejects.toThrow('Name must');
  await renameStudioRecord(
    'library-owner',
    'designs',
    'record-0000',
    '  Lotus  '
  );
  const found = await studioCollectionPage('library-owner', 'designs', {
    q: 'Lotus',
    source: 'generated',
  });
  expect(found.total).toBe(1);
  expect(found.records[0].name).toBe('Lotus');
  expect(
    (
      await studioCollectionPage('library-owner', 'designs', {
        q: 'Lotus',
        source: 'uploaded',
      })
    ).total
  ).toBe(0);
});
it('treats wildcard searches as literal text and clamps invalid pages', async () => {
  expect(
    (await studioCollectionPage('library-owner', 'designs', { q: '%' })).total
  ).toBe(0);
  expect(
    (await studioCollectionPage('library-owner', 'designs', { page: '-30' }))
      .page
  ).toBe(1);
});
