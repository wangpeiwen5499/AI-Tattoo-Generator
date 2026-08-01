import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import {
  getCredits,
  deductCredits,
  refundCredits,
  createProject,
} from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { runGeneration } from '@/server/ai/run-generation'

/**
 * POST /api/generate
 *
 * 请求体：{ bodyPhotoKey: string, bodyPhotoUrl: string, prompt: string }
 *   - bodyPhotoKey / bodyPhotoUrl 由 /api/upload-url 返回
 *   - prompt 是用户的纹身描述（≤ 500 字符）
 *
 * 响应：
 *   200 { projectId }                  立即返回，AI 在 after() 后台跑（异步）
 *   400 校验失败
 *   401 未登录
 *   402 credits 不足
 *   500 ensureUser / 扣费 / createProject 失败（已退款）
 *
 * 异步说明：AI 流程（Step1 + Step2 + 入库 + 退款）在 after() 里执行，
 * 进度/结果由前端轮询 GET /api/generate/status?id=<projectId> 获取。
 *
 * 退款策略：
 *   - Step 1（生成纹身）失败 → 全额退款
 *   - Step 2（4 部位融合）全部失败 → 全额退款
 *   - Step 2 部分失败 → 不退款（用户已拿到价值），但每张标记 status
 */
const MAX_PROMPT_LENGTH = 500

/**
 * Vercel 函数最大执行时间（秒）。
 * AI 生成（KIE 两步：text-to-image + 4 部位并发融合）耗时较长，
 * 不设的话 Vercel 用默认超时（10-60s）会直接杀进程导致 502/超时。
 * 设到 300s（Vercel 各计划上限）覆盖大部分生成。
 * 若 KIE 极慢（总耗时 >5min）仍会超时，需改异步架构。
 */
export const maxDuration = 300

export async function POST(req: Request): Promise<Response> {
  /* 1. Clerk 鉴权 + ensureUser */
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  /* 2. 解析请求体 */
  let body: { bodyPhotoKey?: string; bodyPhotoUrl?: string; prompt?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { bodyPhotoKey, bodyPhotoUrl, prompt } = body
  if (!bodyPhotoKey || !bodyPhotoUrl || !prompt) {
    return NextResponse.json(
      { error: 'Missing required fields: bodyPhotoKey, bodyPhotoUrl, prompt' },
      { status: 400 }
    )
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'prompt must be non-empty' }, { status: 400 })
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} chars.` },
      { status: 400 }
    )
  }

  /* 3. ensureUser（首次入库 + 拿 credits 前置条件） */
  try {
    await ensureUser(userId, email)
  } catch (e) {
    console.error('[generate] ensureUser failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  /* 4. 余额检查（提前拦截，减少无意义 RPC） */
  let credits: number
  try {
    credits = await getCredits(userId)
  } catch (e) {
    console.error('[generate] getCredits failed:', e)
    return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 })
  }
  if (credits < CREDITS_PER_GENERATION) {
    return NextResponse.json(
      { error: 'Insufficient credits', credits },
      { status: 402 }
    )
  }

  /* 5. 扣 credits（原子 RPC；并发竞争时会抛 'Insufficient credits'） */
  try {
    await deductCredits(userId, CREDITS_PER_GENERATION)
  } catch (e) {
    console.error('[generate] deductCredits failed:', e)
    return NextResponse.json({ error: 'Insufficient credits' }, { status: 402 })
  }

  /* 6. 创建 project（status='processing'） */
  let project: { id: string }
  try {
    project = await createProject({ userId, bodyPhotoKey, bodyPhotoUrl, prompt })
  } catch (e) {
    console.error('[generate] createProject failed:', e)
    await safeRefund(userId, CREDITS_PER_GENERATION)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }

  /* 7. 立即返回 projectId，after() 在响应发出后后台跑 AI（异步） */
  after(() =>
    runGeneration({
      projectId: project.id,
      userId,
      bodyPhotoUrl,
      prompt,
    })
  )

  return NextResponse.json({ projectId: project.id })
}

/** 安全退款：即使退款本身失败也不抛错，只记日志（避免吞掉原始错误） */
async function safeRefund(userId: string, amount: number): Promise<void> {
  try {
    await refundCredits(userId, amount)
  } catch (e) {
    console.error('[generate] safeRefund FAILED — credits not returned to user:', e)
  }
}
