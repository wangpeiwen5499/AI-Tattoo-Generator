import { randomUUID } from 'node:crypto';
import { getPublicUrl, getUploadUrl } from '@/lib/r2';
import { readBoundedBody } from '@/server/storage/file-proxy';
import {
  hasImageSignature,
  isAllowedImageType,
} from '@/server/storage/upload-policy';
import { and, count, desc, eq, gte, like } from 'drizzle-orm';

import { db } from '@/core/db';
import { studioAsset, user } from '@/config/db/schema';

import {
  assertAccountStudio,
  MAX_UPLOAD_BYTES,
  StudioError,
} from './policy';

export async function ownedAsset(userId: string, id: string, database = db()) {
  const [asset] = await database
    .select()
    .from(studioAsset)
    .where(and(eq(studioAsset.id, id), eq(studioAsset.userId, userId)));
  if (!asset) throw new StudioError('Image not found', 404);
  return asset;
}
export async function uploadAsset(userId: string, file: File) {
  assertAccountStudio();
  if (
    !file ||
    !isAllowedImageType(file.type) ||
    file.size < 1 ||
    file.size > MAX_UPLOAD_BYTES
  )
    throw new StudioError('Use a PNG, JPEG or WebP image up to 10MB');
  const id = randomUUID();
  const key = `uploads/${userId}/studio-${id}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`;
  return db().transaction(async (tx) => {
    const [owner] = await tx
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId))
      .for('no key update');
    if (!owner?.emailVerified)
      throw new StudioError('Verify your email before uploading images.', 403);
    const uploaded = and(
      eq(studioAsset.userId, userId),
      like(studioAsset.key, 'uploads/%')
    );
    const [{ total }] = await tx
      .select({ total: count() })
      .from(studioAsset)
      .where(
        and(
          uploaded,
          gte(studioAsset.createdAt, new Date(Date.now() - 24 * 60 * 60_000))
        )
      );
    if (total >= 100)
      throw new StudioError(
        'Daily image upload limit reached. Try again later.',
        429
      );
    const body = new Uint8Array(await file.arrayBuffer());
    if (!hasImageSignature(body, file.type))
      throw new StudioError('Invalid image content');
    // Check account quota before expensive decoding or storage work.
    const sharp = (await import('sharp')).default;
    await sharp(body, { limitInputPixels: 40_000_000 }).stats();
    const [latest] = await tx
      .select({ createdAt: studioAsset.createdAt })
      .from(studioAsset)
      .where(uploaded)
      .orderBy(desc(studioAsset.createdAt))
      .limit(1);
    const delay = latest
      ? Math.max(0, 1000 - (Date.now() - latest.createdAt.getTime()))
      : 0;
    // Pace the normal photo/design/guide burst without requiring a client retry.
    // The account row lock serializes parallel tabs through this same interval.
    if (delay)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(delay, 1000))
      );
    const target = await getUploadUrl({
      key,
      contentType: file.type,
      contentLength: body.length,
    });
    const response = await fetch(target.uploadUrl, {
      method: 'PUT',
      body: Buffer.from(body),
      headers: { 'content-type': file.type },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new StudioError('Image storage unavailable', 503);
    await tx.insert(studioAsset).values({
      id,
      userId,
      key,
      contentType: file.type,
      createdAt: new Date(),
    });
    return id;
  });
}
export async function proxyAsset(userId: string, id: string) {
  const asset = await ownedAsset(userId, id);
  const source = await fetch(getPublicUrl(asset.key), {
    redirect: 'error',
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  if (!source.ok) throw new StudioError('Image storage unavailable', 503);
  const bytes = await readBoundedBody(source, 40 * 1024 * 1024);
  if (!hasImageSignature(bytes, asset.contentType))
    throw new StudioError('Invalid stored image', 502);
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': asset.contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
export function providerResultUrl(raw: string | null) {
  const url = new URL(JSON.parse(raw || '{}').resultUrls?.[0]);
  const hosts = [
    'tempfile.redpandaai.co',
    'tempfile.aiquickdraw.com',
    'static.aiquickdraw.com',
    ...(process.env.STUDIO_RESULT_HOSTS || '').split(',').filter(Boolean),
  ];
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    !hosts.includes(url.hostname)
  )
    throw new Error('Invalid provider image source');
  return url.href;
}
