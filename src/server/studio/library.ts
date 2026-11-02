import { and, count, desc, eq, ilike, isNull, or } from 'drizzle-orm';

import { db } from '@/core/db';
import { studioRecord } from '@/config/db/schema';

import { StudioError } from './policy';

export async function studioCollectionPage(
  userId: string,
  collection: 'designs' | 'history',
  options: { page?: string; q?: string; source?: string } = {}
) {
  const q = (typeof options.q === 'string' ? options.q : '')
      .trim()
      .slice(0, 100),
    source = ['generated', 'uploaded', 'sample'].includes(options.source || '')
      ? options.source!
      : '';
  const where = and(
    eq(studioRecord.userId, userId),
    eq(studioRecord.collection, collection),
    isNull(studioRecord.deletedAt),
    source ? eq(studioRecord.source, source) : undefined,
    q
      ? or(
          ilike(studioRecord.name, `%${q.replace(/[\\%_]/g, '\\$&')}%`),
          ilike(studioRecord.prompt, `%${q.replace(/[\\%_]/g, '\\$&')}%`)
        )
      : undefined
  );
  const [result] = await db()
    .select({ total: count() })
    .from(studioRecord)
    .where(where);
  const total = Number(result.total),
    pages = Math.max(1, Math.ceil(total / 24));
  const requested = Number(options.page),
    page = Number.isSafeInteger(requested)
      ? Math.max(1, Math.min(pages, requested))
      : 1;
  const records = await db()
    .select()
    .from(studioRecord)
    .where(where)
    .orderBy(desc(studioRecord.createdAt), desc(studioRecord.id))
    .limit(24)
    .offset((page - 1) * 24);
  return { records, total, page, pages, q, source };
}
export async function renameStudioRecord(
  userId: string,
  collection: string,
  id: string,
  name: unknown
) {
  if (!['designs', 'history'].includes(collection))
    throw new StudioError('Invalid collection');
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 100 ||
    /[\u0000-\u001f\u007f]/.test(name)
  )
    throw new StudioError('Name must contain 1–100 printable characters');
  const rows = await db()
    .update(studioRecord)
    .set({ name: name.trim() })
    .where(
      and(
        eq(studioRecord.id, id),
        eq(studioRecord.userId, userId),
        eq(studioRecord.collection, collection),
        isNull(studioRecord.deletedAt)
      )
    )
    .returning({ id: studioRecord.id });
  if (!rows.length) throw new StudioError('Record not found', 404);
}
