/**
 * POST /api/upload-url
 *
 * 客户端上传图片前先调此接口拿到 R2 预签名 PUT URL。
 * 登录用户和游客均可使用。游客自动发放 guest_id cookie。
 */
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/lib/constants';
import { getUploadUrl, makeObjectKey } from '@/lib/r2';
import {
  createGuestToken,
  GUEST_COOKIE_MAX_AGE,
  verifyGuestToken,
} from '@/server/auth/guest-token';
import { claimUpload } from '@/server/db/guest-queries';
import { isValidUploadSize } from '@/server/storage/upload-policy';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { getSignUser } from '@/shared/models/user';

export async function POST(req: Request): Promise<Response> {
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 2000,
    keyPrefix: 'upload-url',
  });
  if (limited) return limited;
  // 1. 身份：登录用户 / 游客 cookie
  const user = await getSignUser();
  const cookieStore = await cookies();
  let identityId: string;

  if (user?.id) {
    identityId = user.id;
  } else {
    // 游客：读取或创建 guest_id cookie
    const guestId = verifyGuestToken(cookieStore.get('guest_id')?.value);
    if (guestId) {
      identityId = guestId;
    } else {
      identityId = `guest_${randomUUID()}`;
    }
  }

  // 2. 解析请求体
  let body: { contentType?: string; contentLength?: number; ext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object')
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const contentType = body.contentType;
  const isAllowed = (
    ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]
  ).includes(contentType ?? '');
  if (!contentType || !isAllowed) {
    return NextResponse.json(
      {
        error: `Unsupported contentType. Allowed: ${ALLOWED_UPLOAD_CONTENT_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  const contentLength = body.contentLength;
  if (!isValidUploadSize(contentLength)) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  // 3. 生成 R2 预签名上传 URL
  const ext = contentType === 'image/jpeg' ? 'jpg' : contentType.split('/')[1];
  const key = makeObjectKey(identityId, ext);

  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if ((await claimUpload(ip, user?.id ? 100 : 20)) < 0)
      return NextResponse.json(
        { error: 'Daily upload limit reached' },
        { status: 429 }
      );
    const { uploadUrl, publicUrl } = await getUploadUrl({
      key,
      contentType,
      contentLength,
    });
    const response = NextResponse.json({ key, uploadUrl, publicUrl });

    // 游客：首次发放 guest_id cookie（httpOnly, secure, samesite, 30天）
    if (!user?.id) {
      response.cookies.set({
        name: 'guest_id',
        value: createGuestToken(identityId),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: GUEST_COOKIE_MAX_AGE,
        path: '/',
      });
    }

    return response;
  } catch (e) {
    console.error('[upload-url] R2 getUploadUrl failed:', e);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
