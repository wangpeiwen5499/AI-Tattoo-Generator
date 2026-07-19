// Day 3 端到端验证脚本（绕过 Clerk + 业务层）
// 独立验证：KIE API（createTask + recordInfo 轮询） + R2 落图
//
// 注意：本脚本独立实现 KIE 调用逻辑，不 import 业务层 TS 代码。
// 目的是先验证 API 集成本身没问题，业务层集成靠手动调 /api/generate 验证。
//
// 用法: node --env-file=.env.local scripts/verify-day3.mjs

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

const fail = (msg) => { console.error('❌', msg); process.exit(1) }
const ok = (msg) => console.log('✅', msg)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const KIE_BASE_URL = process.env.KIE_BASE_URL || 'https://api.kie.ai'
const KIE_API_KEY = process.env.KIE_API_KEY

if (!KIE_API_KEY) fail('KIE_API_KEY 未配置（请填到 .env.local）')

/* ---------------- KIE 封装（与 src/server/ai/kie-client.ts 同构） -------- */

async function createTask(body) {
  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    fail(`createTask HTTP ${res.status}: ${text}`)
  }
  const json = await res.json()
  if (json.code !== 200 || !json.data?.taskId) {
    fail(`createTask 失败: code=${json.code} msg=${json.msg}`)
  }
  return json.data.taskId
}

async function getRecordInfo(taskId) {
  const res = await fetch(
    `${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    { headers: { Authorization: `Bearer ${KIE_API_KEY}` } }
  )
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

async function pollTask(taskId, { intervalMs = 2000, timeoutMs = 180_000 } = {}) {
  const deadline = Date.now() + timeoutMs
  const startTime = Date.now()
  let last
  let polls = 0
  while (Date.now() < deadline) {
    polls++
    const data = await getRecordInfo(taskId)
    last = data
    if (data.state === 'success') {
      process.stdout.write('\n')
      return { state: 'success', urls: parseResultUrls(data.resultJson), creditsConsumed: data.creditsConsumed, costTime: data.costTime }
    }
    if (data.state === 'failed') {
      process.stdout.write('\n')
      return { state: 'failed', urls: [], failMsg: data.failMsg, creditsConsumed: data.creditsConsumed }
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000)
    process.stdout.write(
      `  [poll #${polls}, ${elapsed}s] state=${data.state} progress=${data.progress ?? 'n/a'}%  \r`
    )
    await sleep(intervalMs)
  }
  // 超时：打印最后一次完整数据，方便排查
  console.error('\n最后一次 recordInfo 完整响应:')
  console.error(JSON.stringify(last, null, 2))
  fail(`轮询超时（${timeoutMs}ms, polls=${polls}），last state=${last?.state}`)
}

/* ---------------- R2 封装（与 src/lib/r2.ts fetchUrlAndUpload 同构） ---- */

function getR2() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })
}

async function fetchAndUpload(sourceUrl, key) {
  const r = await fetch(sourceUrl)
  if (!r.ok) fail(`下载失败: HTTP ${r.status}`)
  const buf = await r.arrayBuffer()
  const contentType = r.headers.get('content-type')?.split(';')[0].trim() || 'image/png'
  const r2 = getR2()
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(buf),
      ContentType: contentType,
    })
  )
  const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
  return { publicUrl, contentType, size: buf.byteLength }
}

/* ---------------- 测试用例 -------------------------------------------- */

console.log('\n── Day 3 验证：KIE 接口 + R2 落图 ──')
console.log(`KIE_BASE_URL = ${KIE_BASE_URL}`)
console.log(`KIE_API_KEY  = ${KIE_API_KEY?.slice(0, 8)}...${KIE_API_KEY?.slice(-4)}`)

// ---- Part 1: text-to-image（生成一张纹身图案） ----
console.log('\n[1/3] KIE text-to-image：生成纹身图案')
const t1TaskId = await createTask({
  model: 'gpt-image-2-text-to-image',
  input: {
    prompt: 'dragon japanese style, tattoo design, white background, clean bold lines, stencil style',
    aspect_ratio: '1:1',
  },
})
console.log(`  taskId = ${t1TaskId}`)
const t1 = await pollTask(t1TaskId)
if (t1.state !== 'success' || t1.urls.length === 0) {
  fail(`text-to-image 失败: state=${t1.state} failMsg=${t1.failMsg}`)
}
const tattooUrl = t1.urls[0]
ok(`text-to-image 成功，耗时 credits=${t1.creditsConsumed}，输出 ${tattooUrl.slice(0, 80)}...`)

// ---- Part 2: 下载纹身图到 R2 ----
console.log('\n[2/3] 把纹身图下载并 PUT 到 R2')
const testKey = `verify-day3/tattoo-${Date.now()}.png`
const upload = await fetchAndUpload(tattooUrl, testKey)
console.log(`  R2 key = ${testKey}`)
console.log(`  大小 = ${upload.size} bytes, contentType = ${upload.contentType}`)

// 通过公开 URL 验证可访问
const verifyRes = await fetch(upload.publicUrl)
if (!verifyRes.ok) fail(`R2 公开 URL 访问失败: HTTP ${verifyRes.status}`)
ok(`R2 公开 URL 访问成功: ${upload.publicUrl.slice(0, 80)}...`)

// ---- Part 3: image-to-image（用纹身图 + 测试身体图融合） ----
console.log('\n[3/3] KIE image-to-image：纹身融合到身体')
const bodyPhotoUrl = 'https://static.aiquickdraw.com/tools/example/1776782793756_wrogXTdd.png'
const t2TaskId = await createTask({
  model: 'gpt-image-2-image-to-image',
  input: {
    prompt: 'Apply this tattoo design naturally on the left arm of the person in the photo. Realistic skin texture, lighting and perspective.',
    input_urls: [bodyPhotoUrl, upload.publicUrl],
    aspect_ratio: '3:4',
  },
})
console.log(`  taskId = ${t2TaskId}`)
const t2 = await pollTask(t2TaskId, { timeoutMs: 240_000 }) // 图生图可能比文生图慢，给 4 分钟
if (t2.state !== 'success' || t2.urls.length === 0) {
  fail(`image-to-image 失败: state=${t2.state} failMsg=${t2.failMsg}`)
}
ok(`image-to-image 成功，credits=${t2.creditsConsumed}`)
console.log(`  输出预览: ${t2.urls[0].slice(0, 100)}...`)

console.log('\n── 总结 ──')
console.log('✅ KIE text-to-image：成功')
console.log('✅ R2 落图：成功（KIE → R2 公开 URL 链路通）')
console.log('✅ KIE image-to-image：成功')
console.log('\n🎉 Day 3 API 集成验证通过！')
console.log('   下一步：手动调 /api/generate 跑业务层端到端测试。')
