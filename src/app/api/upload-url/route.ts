import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
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
  // 1. 验证登录
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 拿 email（用于 ensureUser）
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'Email is required. Please add an email in your account.' }, { status: 400 })
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

  // 4. 首次调用自动建用户记录（送 1 credit）
  try {
    await ensureUser(userId, email)
  } catch (e) {
    console.error('[upload-url] ensureUser failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  // 5. 生成 R2 预签名上传 URL
  const ext = body.ext || contentType!.split('/')[1] || 'jpg'
  const key = makeObjectKey(userId, ext)

  try {
    const { uploadUrl, publicUrl } = await getUploadUrl({ key, contentType: contentType!, contentLength })
    return NextResponse.json({ key, uploadUrl, publicUrl })
  } catch (e) {
    console.error('[upload-url] R2 getUploadUrl failed:', e)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}
