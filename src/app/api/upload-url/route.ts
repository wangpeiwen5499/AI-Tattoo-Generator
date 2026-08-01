import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getActor } from '@/server/auth/actor'
import { ensureUser, ensureGuest } from '@/server/db/ensure-user'
import { getUploadUrl, makeObjectKey } from '@/lib/r2'
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'

/**
 * POST /api/upload-url
 *
 * 客户端上传图片前先调此接口拿到 R2 预签名 PUT URL。
 * 之后客户端直接 fetch PUT 到该 URL 上传文件，不经 Next.js 服务器（省带宽）。
 *
 * 请求体：{ contentType: string, contentLength?: number, ext?: string }
 * 响应：{ key: string, uploadUrl: string, publicUrl: string }
 *
 * 副作用：首次调用会 ensureUser 创建用户记录（送 1 免费 credit）。
 */
export async function POST(req: Request): Promise<Response> {
  // 1. 身份：登录用 userId，游客用 guest_id cookie
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json({ error: 'Failed to identify session' }, { status: 500 })
  }

  // 3. 解析并校验请求体
  let body: { contentType?: string; contentLength?: number; ext?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contentType = body.contentType
  const isAllowed = (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(contentType ?? '')
  if (!contentType || !isAllowed) {
    return NextResponse.json(
      { error: `Unsupported contentType. Allowed: ${ALLOWED_UPLOAD_CONTENT_TYPES.join(', ')}` },
      { status: 400 }
    )
  }

  const contentLength = body.contentLength
  if (contentLength !== undefined && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large. Max ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.` },
      { status: 413 }
    )
  }

  // 4. 确保数据库有该身份的行（登录 ensureUser + email；游客 ensureGuest）
  try {
    if (actor.type === 'user') {
      const user = await currentUser()
      const email = user?.emailAddresses?.[0]?.emailAddress
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required. Please add an email in your account.' },
          { status: 400 }
        )
      }
      await ensureUser(actor.id, email)
    } else {
      await ensureGuest(actor.id)
    }
  } catch (e) {
    console.error('[upload-url] ensureUser/Guest failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  // 5. 生成 R2 预签名上传 URL（用 actor.id 拼 key）
  const ext = body.ext || contentType!.split('/')[1] || 'jpg'
  const key = makeObjectKey(actor.id, ext)

  try {
    const { uploadUrl, publicUrl } = await getUploadUrl({ key, contentType: contentType!, contentLength })
    return NextResponse.json({ key, uploadUrl, publicUrl })
  } catch (e) {
    console.error('[upload-url] R2 getUploadUrl failed:', e)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
