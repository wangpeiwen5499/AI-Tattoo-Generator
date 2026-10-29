import { createHmac, timingSafeEqual } from 'node:crypto';

export const GUEST_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const GUEST_ID =
  /^guest_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function signature(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new Error('AUTH_SECRET must contain at least 32 characters');
  return createHmac('sha256', secret)
    .update(`tattoo-guest:v1:${payload}`)
    .digest('base64url');
}

export function createGuestToken(id: string, now = Date.now()): string {
  if (!GUEST_ID.test(id)) throw new Error('Invalid guest ID');
  const payload = `${id}.${Math.floor(now / 1000) + GUEST_COOKIE_MAX_AGE}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyGuestToken(
  token: string | undefined,
  now = Date.now()
): string | null {
  if (!token || token.length > 200) return null;
  const [id, expiry, mac, extra] = token.split('.');
  if (
    extra !== undefined ||
    !GUEST_ID.test(id ?? '') ||
    !/^\d{10}$/.test(expiry ?? '') ||
    !mac
  )
    return null;
  const expiresAt = Number(expiry);
  if (
    expiresAt <= now / 1000 ||
    expiresAt > now / 1000 + GUEST_COOKIE_MAX_AGE + 60
  )
    return null;
  try {
    const expected = signature(`${id}.${expiry}`);
    if (
      mac.length !== expected.length ||
      !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
    )
      return null;
    return id;
  } catch {
    return null;
  }
}
