import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  cookies: vi.fn(),
  upload: vi.fn(),
  send: vi.fn(),
  fetch: vi.fn(),
}));
vi.mock('@/shared/models/user', () => ({ getSignUser: mocks.user }));
vi.mock('next/headers', () => ({ cookies: mocks.cookies }));
vi.mock('@/shared/services/email', () => ({
  getEmailService: () => ({ sendEmail: mocks.send }),
}));

describe('guest identity boundary', () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = 'local-test-secret-at-least-32-characters';
    mocks.user.mockResolvedValue(null);
  });

  it('rejects unsigned cookies, including a real user id', async () => {
    const { getActor } = await import('@/server/auth/actor');
    for (const id of [randomUUID(), `guest_${randomUUID()}`]) {
      mocks.cookies.mockResolvedValue({ get: () => ({ value: id }) });
      expect(await getActor()).toBeNull();
    }
  });

  it('accepts signed guests and rejects tampering and expiry', async () => {
    const { createGuestToken, verifyGuestToken } =
      await import('@/server/auth/guest-token');
    const id = `guest_${randomUUID()}`;
    const now = Date.now();
    const token = createGuestToken(id, now);
    expect(verifyGuestToken(token, now)).toBe(id);
    expect(verifyGuestToken(`${token}x`, now)).toBeNull();
    expect(verifyGuestToken(token, now + 31 * 86400000)).toBeNull();
    expect(() => createGuestToken(randomUUID(), now)).toThrow();
  });
});

describe('legacy public endpoints', () => {
  it('disables the test mail sender without sending mail', async () => {
    const { POST } = await import('@/app/api/email/send-email/route');
    const response = await POST(
      new Request('https://local/api/email/send-email', {
        method: 'POST',
        body: JSON.stringify({ emails: 'test@example.com', subject: 'test' }),
      })
    );
    expect(response.status).toBe(410);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated generic uploads before reading the body', async () => {
    mocks.user.mockResolvedValue(null);
    const { POST } = await import('@/app/api/storage/upload-image/route');
    const response = await POST(
      new Request('https://local/api/storage/upload-image', { method: 'POST' })
    );
    expect(response.status).toBe(401);
  });

  it('rejects arbitrary proxy origins without making a network request', async () => {
    vi.stubGlobal('fetch', mocks.fetch);
    const { GET } = await import('@/app/api/proxy/file/route');
    const { NextRequest } = await import('next/server');
    const response = await GET(
      new NextRequest(
        'https://local/api/proxy/file?url=http://127.0.0.1/secrets'
      )
    );
    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('upload ownership', () => {
  it('accepts only canonical upload keys owned by this actor', async () => {
    const { isOwnedUploadKey } = await import('@/server/storage/upload-policy');
    const id = `guest_${randomUUID()}`;
    expect(isOwnedUploadKey(`uploads/${id}/${randomUUID()}.png`, id)).toBe(
      true
    );
    for (const key of [
      `uploads/someone-else/${randomUUID()}.png`,
      `uploads/${id}/../private.png`,
      `uploads/${id}/%2e%2e%2fprivate.png`,
      `outputs/${id}/${randomUUID()}.png`,
    ])
      expect(isOwnedUploadKey(key, id)).toBe(false);
  });
});
