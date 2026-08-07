import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

/**
 * Cloudflare R2 存储（S3 兼容）封装（从 Demo 迁入 ShipAny Two）。
 *
 * 工作方式：客户端调用 /api/upload-url 获取预签名 PUT URL，
 * 然后直接 fetch PUT 把图片上传到 R2，不经过 Next.js 服务器（省带宽）。
 * 上传完成后用 {R2_PUBLIC_URL}/{key} 公开访问。
 */

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET_NAME = process.env.R2_BUCKET_NAME
const PUBLIC_URL = process.env.R2_PUBLIC_URL

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

/** 生成上传对象 key。格式：uploads/{userId}/{uuid}.{ext} */
export function makeObjectKey(userId: string, ext: string): string {
  const safeExt = ext.replace(/^\./, '').toLowerCase() || 'jpg'
  return `uploads/${userId}/${randomUUID()}.${safeExt}`
}

/** 把 R2 key 拼成公开访问 URL */
export function getPublicUrl(key: string): string {
  if (!PUBLIC_URL) {
    throw new Error('Missing R2_PUBLIC_URL env var')
  }
  const base = PUBLIC_URL.replace(/\/+$/, '')
  return `${base}/${key.replace(/^\/+/, '')}`
}

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** 生成预签名 PUT URL */
export async function getUploadUrl(opts: {
  key: string
  contentType: string
  contentLength?: number
}): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  const { key, contentType } = opts

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`)
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

/** AI 输出图 key 格式：outputs/{userId}/{projectId}/{uuid}.{ext} */
export function makeOutputKey(userId: string, projectId: string, ext = 'png'): string {
  const safeExt = ext.replace(/^\./, '').toLowerCase() || 'png'
  return `outputs/${userId}/${projectId}/${randomUUID()}.${safeExt}`
}

/** 从外部 URL 下载并直接 PUT 到 R2 */
export async function fetchUrlAndUpload(
  sourceUrl: string,
  key: string
): Promise<{ key: string; publicUrl: string; contentType: string }> {
  const response = await fetch(sourceUrl)
  if (!response.ok) {
    throw new Error(`fetchUrlAndUpload: failed to fetch ${sourceUrl}: HTTP ${response.status}`)
  }

  const buffer = await response.arrayBuffer()
  const contentType = response.headers.get('content-type')?.split(';')[0].trim() || 'image/png'

  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: new Uint8Array(buffer),
      ContentType: contentType,
    })
  )

  return { key, publicUrl: getPublicUrl(key), contentType }
}
