import { randomBytes } from 'node:crypto';
import { prepareDesignReference } from '@/server/storage/design-reference';
import sharp from 'sharp';
import { expect, it } from 'vitest';

it('keeps small design files byte-for-byte unchanged', async () => {
  const source = await sharp({
    create: { width: 100, height: 100, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  const result = await prepareDesignReference(
    source,
    'image/png',
    30 * 1024 * 1024
  );
  expect(result.buffer).toBe(source);
  expect(result.contentType).toBe('image/png');
});

it('compresses an oversized reference without changing its pixel dimensions', async () => {
  const raw = randomBytes(512 * 512 * 3);
  const source = await sharp(raw, {
    raw: { width: 512, height: 512, channels: 3 },
  })
    .png()
    .toBuffer();
  const limit = source.length - 1;
  const result = await prepareDesignReference(source, 'image/png', limit);
  expect(result.buffer.length).toBeLessThanOrEqual(limit);
  expect(result.contentType).toBe('image/jpeg');
  expect(await sharp(result.buffer).metadata()).toMatchObject({
    width: 512,
    height: 512,
  });
});

it('fails before body generation when a reference cannot fit the provider limit', async () => {
  const source = await sharp({
    create: { width: 64, height: 64, channels: 3, background: 'white' },
  })
    .png()
    .toBuffer();
  await expect(prepareDesignReference(source, 'image/png', 1)).rejects.toThrow(
    'reference'
  );
});
