/**
 * POST /api/upload-url
 *
 * 客户端上传图片前先调此接口拿到 R2 预签名 PUT URL。
 * 仅允许已登录且邮箱已验证的用户上传。
 */
import { NextResponse } from 'next/server';
import {
  ALLOWED_UPLOAD_CONTENT_TYPES,
  MAX_UPLOAD_BYTES,
} from '@/lib/constants';
import { getUploadUrl, makeObjectKey } from '@/lib/r2';
import { requireGenerationUser } from '@/server/auth/generation-access';
import { claimUpload } from '@/server/db/guest-queries';
import { isValidUploadSize } from '@/server/storage/upload-policy';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

export async function POST(req: Request): Promise<Response> {
  const access = await requireGenerationUser();
  if (access.response) return access.response;
  const user = access.user;
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 2000,
    keyPrefix: 'upload-url',
    extraKey: user.id,
  });
  if (limited) return limited;
  const identityId = user.id;

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
    if ((await claimUpload(ip, 100)) < 0)
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

    return response;
  } catch (e) {
    console.error('[upload-url] R2 getUploadUrl failed:', e);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
