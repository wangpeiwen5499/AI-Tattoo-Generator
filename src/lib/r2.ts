import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

/**
 * Cloudflare R2 存储（S3 兼容）封装。
 *
 * 工作方式：客户端调用 /api/upload-url 获取预签名 PUT URL，
 * 然后直接 fetch PUT 把图片上传到 R2，不经过 Next.js 服务器（省带宽）。
 * 上传完成后用 {R2_PUBLIC_URL}/{key} 公开访问。
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_BUCKET_NAME
const PUBLIC_URL = process.env.R2_PUBLIC_URL // 例：https://tattoo-images.yourdomain.com

function getS3Client(): S3Client {
  if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY) {
    throw new Error(
      'Missing R2 env vars. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.local'
    )
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
  })
}

export function getBucketName(): string {
  if (!BUCKET_NAME) {
    throw new Error('Missing R2_BUCKET_NAME env var')
  }
  return BUCKET_NAME
}

/**
 * 生成上传对象 key。用 UUID 防止遍历和文件名冲突。
 * 格式：uploads/{userId}/{uuid}.{ext}
 */
export function makeObjectKey(userId: string, ext: string): string {
  const safeExt = ext.replace(/^\./, '').toLowerCase() || 'jpg'
  return `uploads/${userId}/${randomUUID()}.${safeExt}`
}

/** 把 R2 key 拼成公开访问 URL */
export function getPublicUrl(key: string): string {
  if (!PUBLIC_URL) {
    throw new Error('Missing R2_PUBLIC_URL env var')
  }
  // 去掉两端多余的斜杠
  const base = PUBLIC_URL.replace(/\/+$/, '')
  return `${base}/${key.replace(/^\/+/, '')}`
}

/** 允许的上传 Content-Type */
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
])

/**
 * 生成预签名 PUT URL，客户端拿到后直接 fetch PUT 上传。
 * URL 有效期 10 分钟（R2 上传通常几秒）。
 */
export async function getUploadUrl(opts: {
  key: string
  contentType: string
  contentLength?: number // 字节；可选但建议校验，最大 10MB
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const { key, contentType } = opts

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}. Allowed: image/jpeg, image/png, image/webp`)
  }
  if (opts.contentLength !== undefined && opts.contentLength > 10 * 1024 * 1024) {
    throw new Error('File too large. Max 10MB.')
  }

  const client = getS3Client()
  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType,
    ContentLength: opts.contentLength,
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 10 })
  return { uploadUrl, publicUrl: getPublicUrl(key), key }
}
