// Day 2 端到端验证脚本（绕过 Clerk）
// 用 PostgREST API 直接测 Supabase，避免 realtime/websocket 兼容问题
// 用法: node --env-file=.env.local scripts/verify-day2.mjs

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const fail = (msg) => { console.error('❌', msg); process.exit(1) }
const ok = (msg) => console.log('✅', msg)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// PostgREST 调用封装
async function db(method, table, { body, select, filters, prefer } = {}) {
  const params = new URLSearchParams()
  if (select) params.set('select', select)
  const qs = filters ? filters.join('&') : ''
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params.toString()}${qs ? '&' + qs : ''}`
  const res = await fetch(url, {
    method,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer ?? (method === 'POST' || method === 'PUT' ? 'return=representation' : ''),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = text ? JSON.parse(text) : null } catch {}
  return { ok: res.ok, status: res.status, json, text }
}

async function rpc(name, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  return { ok: res.ok, status: res.status, text: await res.text() }
}

// ============ Part 1: Supabase 数据库测试 ============
console.log('\n── Supabase 数据库测试 ──')

if (!SUPABASE_URL) fail('NEXT_PUBLIC_SUPABASE_URL 未配置')
if (!SERVICE_KEY) fail('SUPABASE_SERVICE_ROLE_KEY 未配置')

const testUserId = `verify-day2-${Date.now()}`
const testEmail = `verify-day2-${Date.now()}@test.local`

// 1.1 upsert users 表（模拟 ensureUser）
console.log(`\n[1/5] upsert users 表 (id=${testUserId})`)
const ins = await db('POST', 'users', { body: { id: testUserId, email: testEmail } })
if (!ins.ok) fail(`upsert users 失败: ${ins.status} ${ins.text}`)
const user = Array.isArray(ins.json) ? ins.json[0] : ins.json
if (!user) fail('upsert users 返回空数据')
if (user.credits !== 1) fail(`credits 应该是 1（默认值），实际是 ${user.credits}`)
ok(`users 表写入成功，credits=${user.credits}, email=${user.email}`)

// 1.2 测试 deduct_credits RPC
console.log(`\n[2/5] 测试 deduct_credits RPC（扣 1 credit）`)
const dec = await rpc('deduct_credits', { p_user_id: testUserId, p_amount: 1 })
if (!dec.ok) fail(`deduct_credits 失败: ${dec.status} ${dec.text}`)
const check1 = await db('GET', 'users', { select: 'credits', filters: [`id=eq.${testUserId}`] })
if (check1.json[0].credits !== 0) fail(`扣减后 credits 应为 0，实际 ${check1.json[0].credits}`)
ok(`deduct_credits 成功，余额 1 → 0`)

// 1.3 测试 deduct_credits 余额不足时拒绝
console.log(`\n[3/5] 测试 deduct_credits 余额不足时拒绝`)
const noBalance = await rpc('deduct_credits', { p_user_id: testUserId, p_amount: 1 })
if (noBalance.ok) fail('余额不足时应该抛异常，但没有')
ok(`余额不足时正确拒绝: HTTP ${noBalance.status}`)

// 1.4 测试 add_credits RPC
console.log(`\n[4/5] 测试 add_credits RPC（加 5 credits）`)
const inc = await rpc('add_credits', { p_user_id: testUserId, p_amount: 5 })
if (!inc.ok) fail(`add_credits 失败: ${inc.status} ${inc.text}`)
const check2 = await db('GET', 'users', { select: 'credits', filters: [`id=eq.${testUserId}`] })
if (check2.json[0].credits !== 5) fail(`加完后 credits 应为 5，实际 ${check2.json[0].credits}`)
ok(`add_credits 成功，余额 0 → 5`)

// 1.5 测试 projects 表
console.log(`\n[5/5] 测试 projects 表插入`)
const projIns = await db('POST', 'projects', {
  body: {
    user_id: testUserId,
    body_photo_key: 'test/key.jpg',
    body_photo_url: 'https://test/x.jpg',
    prompt: 'test dragon',
    status: 'pending',
  },
})
if (!projIns.ok) fail(`insert projects 失败: ${projIns.status} ${projIns.text}`)
const proj = Array.isArray(projIns.json) ? projIns.json[0] : projIns.json
ok(`projects 表写入成功，id=${proj.id}, status=${proj.status}, prompt="${proj.prompt}"`)

// 清理（级联删除会带走 projects）
await db('DELETE', 'users', { filters: [`id=eq.${testUserId}`] })
const after = await db('GET', 'users', { select: 'id', filters: [`id=eq.${testUserId}`] })
if (after.json.length > 0) fail('清理失败：用户记录仍存在')
ok('测试数据已清理')

// ============ Part 2: R2 存储测试 ============
console.log('\n── Cloudflare R2 存储测试 ──')

const r2NotConfigured =
  !process.env.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID === 'xxx' ||
  !process.env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID === 'xxx' ||
  !process.env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY === 'xxx'

if (r2NotConfigured) {
  console.log('⚠️  R2 API Token 未配置（R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY），跳过 R2 测试')
  console.log('\n── 总结 ──')
  console.log('✅ Supabase 数据库：完美通过 5/5')
  console.log('⚠️  R2 存储：跳过（请配置 R2 API Token 后重跑此脚本）')
  process.exit(0)
}

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const testKey = `verify-test/verify-${Date.now()}.txt`

// 2.1 生成预签名 URL
console.log(`\n[1/3] 生成预签名 PUT URL`)
const putCmd = new PutObjectCommand({
  Bucket: process.env.R2_BUCKET_NAME,
  Key: testKey,
  ContentType: 'text/plain',
})
const uploadUrl = await getSignedUrl(r2, putCmd, { expiresIn: 60 })
ok(`预签名 URL 生成成功（${uploadUrl.length} 字符）`)

// 2.2 实际上传一个文件
console.log(`\n[2/3] 实际 PUT 上传测试文件`)
const uploadRes = await fetch(uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'text/plain' },
  body: `Day 2 R2 verify test at ${new Date().toISOString()}`,
})
if (!uploadRes.ok) fail(`上传失败: HTTP ${uploadRes.status} ${uploadRes.statusText}`)
ok(`上传成功: HTTP ${uploadRes.status}`)

// 2.3 通过公开 URL 访问
console.log(`\n[3/3] 通过 R2_PUBLIC_URL 访问`)
const publicUrl = `${process.env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${testKey}`
const getRes = await fetch(publicUrl)
if (!getRes.ok) fail(`公开访问失败: HTTP ${getRes.status}（可能需要在 R2 bucket 设置 Public Access）`)
const text = await getRes.text()
ok(`公开访问成功: HTTP ${getRes.status}, body 长度=${text.length}`)

// 清理
await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: testKey }))
ok('测试对象已清理')

console.log('\n── 总结 ──')
console.log('✅ Supabase 数据库：完美通过 5/5')
console.log('✅ R2 存储：完美通过 3/3')
console.log('\n🎉 Day 2 验收通过！可以开始 Day 3 了。')
