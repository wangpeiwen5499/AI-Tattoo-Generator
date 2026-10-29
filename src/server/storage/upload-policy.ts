import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/lib/constants';

const UPLOAD_FILE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|jpeg|png|webp)$/;

export function isOwnedUploadKey(key: unknown, actorId: string): key is string {
  if (typeof key !== 'string' || !actorId || /[\/.%\\]/.test(actorId))
    return false;
  const prefix = `uploads/${actorId}/`;
  return key.startsWith(prefix) && UPLOAD_FILE.test(key.slice(prefix.length));
}

export function isValidUploadSize(size: unknown): size is number {
  return (
    typeof size === 'number' &&
    Number.isSafeInteger(size) &&
    size > 0 &&
    size <= MAX_UPLOAD_BYTES
  );
}

export function isAllowedImageType(type: unknown): type is string {
  return (
    typeof type === 'string' &&
    (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(type)
  );
}

export function hasImageSignature(bytes: Uint8Array, type: string): boolean {
  if (type === 'image/jpeg')
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png')
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  if (type === 'image/webp')
    return (
      Buffer.from(bytes.slice(0, 4)).toString() === 'RIFF' &&
      Buffer.from(bytes.slice(8, 12)).toString() === 'WEBP'
    );
  return false;
}
