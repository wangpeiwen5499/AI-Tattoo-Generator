/**
 * POST /api/upload-url
 *
 * 客户端上传图片前先调此接口拿到 R2 预签名 PUT URL。
 * 登录用户和游客均可使用。游客自动发放 guest_id cookie。
 */
import { randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSignUser } from '@/shared/models/user';
import { getUploadUrl, makeObjectKey } from '@/lib/r2';
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants';

export async function POST(req: Request): Promise<Response> {
  // 1. 身份：登录用户 / 游客 cookie
  const user = await getSignUser();
  const cookieStore = await cookies();
  let identityId: string;

  if (user?.id) {
    identityId = user.id;
  } else {
    // 游客：读取或创建 guest_id cookie
    const guestId = cookieStore.get('guest_id')?.value;
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

  const contentType = body.contentType;
  const isAllowed = (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(contentType ?? '');
  if (!contentType || !isAllowed) {
    return NextResponse.json(
      { error: `Unsupported contentType. Allowed: ${ALLOWED_UPLOAD_CONTENT_TYPES.join(', ')}` },
      { status: 400 }
    );
  }

  const contentLength = body.contentLength;
  if (contentLength !== undefined && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  // 3. 生成 R2 预签名上传 URL
  const ext = body.ext || contentType.split('/')[1] || 'jpg';
  const key = makeObjectKey(identityId, ext);

  try {
    const { uploadUrl, publicUrl } = await getUploadUrl({ key, contentType, contentLength });
    const response = NextResponse.json({ key, uploadUrl, publicUrl });

    // 游客：首次发放 guest_id cookie（httpOnly, secure, samesite, 30天）
    if (!user?.id && !cookieStore.get('guest_id')) {
      response.cookies.set({
        name: 'guest_id',
        value: identityId,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      });
    }

    return response;
  } catch (e) {
    console.error('[upload-url] R2 getUploadUrl failed:', e);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
