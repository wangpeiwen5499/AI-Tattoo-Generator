// 生成首页 showcase 示例图：8 个经典纹身题材 × 无脸身体照 → KIE 两步生成 → R2 showcase/
//
// 用法: node --env-file=.env.local scripts/gen-showcase.mjs
//
// 前置（二选一，在 BODY_PHOTOS 填好后再跑）：
//   A. 上传无脸局部身体照（只拍手臂/腿/肩，不含头）到 R2 showcase/body/，填 public URL
//   B. 直接填 Unsplash 直链 URL（无脸局部身体照，免费商用）
// 消耗：~48 KIE credits ≈ $0.24（8 × (text-to-image 6 + image-to-image 6)）

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const fail = (msg) => { console.error('❌', msg); process.exit(1) }
const ok = (msg) => console.log('✅', msg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const KIE_BASE_URL = process.env.KIE_BASE_URL || 'https://api.kie.ai'
const KIE_API_KEY = process.env.KIE_API_KEY
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL
if (!KIE_API_KEY) fail('KIE_API_KEY 未配置（填到 .env.local）')
if (!R2_PUBLIC_URL) fail('R2_PUBLIC_URL 未配置')

/* 8 个示例（slug 与 src/lib/showcase-examples.ts 的 key 对应） */
const EXAMPLES = [
  { slug: 'dragon', prompt: 'dragon, japanese irezumi style, bold black lines with red accents' },
  { slug: 'rose', prompt: 'red rose with green leaves, old school traditional style' },
  { slug: 'koi', prompt: 'koi fish swimming upstream, japanese traditional, black and orange' },
  { slug: 'skull', prompt: 'skull with roses, black and grey realism' },
  { slug: 'mandala', prompt: 'mandala, symmetrical geometric, fine line blackwork' },
  { slug: 'snake', prompt: 'snake coiled around a dagger, traditional american' },
  { slug: 'butterfly', prompt: 'butterfly, watercolor style, vibrant' },
  { slug: 'phoenix', prompt: 'phoenix rising, japanese, black and red' },
]

/* 无脸身体照（长度 ≥ 1；少于 8 张则循环复用）。
   ⚠️ 跑脚本前在这里填好 URL（R2 showcase/body/* 或 Unsplash 直链）。 */
const BODY_PHOTOS = [
  // `${R2_PUBLIC_URL}/showcase/body/body-1.jpg`,
  // 'https://images.unsplash.com/photo-xxx?w=1024',
]
if (BODY_PHOTOS.length === 0) {
  fail('BODY_PHOTOS 为空：请上传无脸身体照到 R2 showcase/body/ 或填 Unsplash URL 后再跑')
}

/* ---- KIE 封装（与 src/server/ai/kie-client.ts 同构） ---- */
async function createTask(body) {
  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KIE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) fail(`createTask HTTP ${res.status}: ${await res.text().catch(() => '')}`)
  const json = await res.json()
  if (json.code !== 200 || !json.data?.taskId) fail(`createTask 失败: code=${json.code} msg=${json.msg}`)
  return json.data.taskId
}

async function getRecordInfo(taskId) {
  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, {
    headers: { Authorization: `Bearer ${KIE_API_KEY}` },
  })
  if (!res.ok) fail(`recordInfo HTTP ${res.status}`)
  const json = await res.json()
  if (!json.data) fail(`recordInfo 空 data: ${JSON.stringify(json)}`)
  return json.data
}

function parseResultUrls(resultJson) {
  if (!resultJson) return []
  try {
    const parsed = JSON.parse(resultJson)
    return Array.isArray(parsed.resultUrls) ? parsed.resultUrls : []
  } catch {
    return []
  }
}

async function pollTask(taskId, { intervalMs = 2000, timeoutMs = 240_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  let last
  let polls = 0
  while (Date.now() < deadline) {
    polls++
    const data = await getRecordInfo(taskId)
    last = data
    if (data.state === 'success') {
      process.stdout.write('\n')
      return { state: 'success', urls: parseResultUrls(data.resultJson), credits: data.creditsConsumed }
    }
    // 认 'fail'（实测）和 'failed'（防御）
    if (data.state === 'failed' || data.state === 'fail') {
      process.stdout.write('\n')
      return { state: 'failed', urls: [], failMsg: data.failMsg, credits: data.creditsConsumed }
    }
    process.stdout.write(`  [poll #${polls}] state=${data.state} progress=${data.progress ?? 'n/a'}%  \r`)
    await sleep(intervalMs)
  }
  console.error('\n最后一次 recordInfo:', JSON.stringify(last, null, 2))
  fail(`轮询超时（polls=${polls}），last state=${last?.state}`)
}

/* ---- R2 封装（与 src/lib/r2.ts fetchUrlAndUpload 同构） ---- */
function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  })
}

async function fetchAndUpload(sourceUrl, key) {
  const r = await fetch(sourceUrl)
  if (!r.ok) fail(`下载失败 ${sourceUrl}: HTTP ${r.status}`)
  const buf = await r.arrayBuffer()
  const contentType = r.headers.get('content-type')?.split(';')[0].trim() || 'image/png'
  await getR2().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: new Uint8Array(buf),
    ContentType: contentType,
  }))
  return `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
}

/* ---- 生成流程 ---- */
const FUSION_PROMPT = (desc) =>
  `Apply this tattoo design naturally on the body of the person in the photo. ` +
  `Make it look real with natural skin texture, lighting, perspective, and wrap slightly to follow the body contour. ` +
  `Do not change anything else in the photo. (design: ${desc})`

console.log('\n── 生成 showcase 示例图 ──')
console.log(`KIE_BASE_URL = ${KIE_BASE_URL}`)
console.log(`身体照数量 = ${BODY_PHOTOS.length}（将循环复用到 ${EXAMPLES.length} 个题材）`)

let totalCredits = 0
for (let i = 0; i < EXAMPLES.length; i++) {
  const { slug, prompt } = EXAMPLES[i]
  const bodyPhotoUrl = BODY_PHOTOS[i % BODY_PHOTOS.length]
  console.log(`\n[${i + 1}/${EXAMPLES.length}] ${slug}: ${prompt}`)

  // 1. text-to-image：生成纹身图案
  const designTaskId = await createTask({
    model: 'gpt-image-2-text-to-image',
    input: { prompt: `${prompt}, tattoo design, white background, clean bold lines, high contrast, stencil style`, aspect_ratio: '1:1' },
  })
  const design = await pollTask(designTaskId)
  if (design.state !== 'success' || design.urls.length === 0) fail(`${slug} 纹身图生成失败: ${design.failMsg}`)

  // 纹身图临时落 R2（作 image-to-image 输入）
  const designUrl = await fetchAndUpload(design.urls[0], `showcase/_tmp/${slug}-design-${Date.now()}.png`)

  // 2. image-to-image：融合到身体（3:4）
  const fusionTaskId = await createTask({
    model: 'gpt-image-2-image-to-image',
    input: { prompt: FUSION_PROMPT(prompt), input_urls: [bodyPhotoUrl, designUrl], aspect_ratio: '3:4' },
  })
  const fusion = await pollTask(fusionTaskId)
  if (fusion.state !== 'success' || fusion.urls.length === 0) fail(`${slug} 融合失败: ${fusion.failMsg}`)

  // 3. 最终图落到 R2 showcase/<slug>.png
  const finalUrl = await fetchAndUpload(fusion.urls[0], `showcase/${slug}.png`)
  totalCredits += (design.credits || 0) + (fusion.credits || 0)
  console.log(`  -> ${finalUrl} (credits: ${design.credits}+${fusion.credits})`)
  ok(`${slug} 完成`)
}

console.log(`\n🎉 全部完成！8 张图已落到 R2 showcase/，共消耗 ${totalCredits} KIE credits`)
console.log('   首页 showcase 现在应显示真实示例图。')
