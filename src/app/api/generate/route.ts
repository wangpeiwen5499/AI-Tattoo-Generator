import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import {
  getCredits,
  deductCredits,
  refundCredits,
  createProject,
  recordGenerations,
  updateProjectStatus,
} from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { generateTattooDesign } from '@/server/ai/generate-tattoo'
import { applyTattooToBody } from '@/server/ai/apply-to-body'

/**
 * POST /api/generate
 *
 * 请求体：{ bodyPhotoKey: string, bodyPhotoUrl: string, prompt: string }
 *   - bodyPhotoKey / bodyPhotoUrl 由 /api/upload-url 返回
 *   - prompt 是用户的纹身描述（≤ 500 字符）
 *
 * 响应：
 *   200 { projectId, tattooDesignUrl, images: [{bodyPart, status, url}] }
 *   400 校验失败
 *   401 未登录
 *   402 credits 不足
 *   500 服务端错误（已 refund credits）
 *
 * 退款策略：
 *   - Step 1（生成纹身）失败 → 全额退款
 *   - Step 2（4 部位融合）全部失败 → 全额退款
 *   - Step 2 部分失败 → 不退款（用户已拿到价值），但每张标记 status
 */
const MAX_PROMPT_LENGTH = 500

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

  /* 7. 执行 AI 流程（Step 1 + Step 2） */
  try {
    // Step 1：生成纹身图案
    const tattoo = await generateTattooDesign({
      prompt,
      userId,
      projectId: project.id,
    })

    // Step 2：4 部位并发融合
    const fusionResults = await applyTattooToBody({
      bodyPhotoUrl,
      tattooDesignUrl: tattoo.r2Url,
      userId,
      projectId: project.id,
    })

    // 8. 入库 generations（4 条，含共享的 tattoo_image_key）
    await recordGenerations(
      project.id,
      userId,
      tattoo.r2Key,
      fusionResults.map((r) => ({
        bodyPart: r.bodyPart,
        status: r.status,
        resultImageKey: r.image?.r2Key ?? null,
        resultImageUrl: r.image?.r2Url ?? null,
      }))
    )

    // 9. 判断整体状态
    const successCount = fusionResults.filter((r) => r.status === 'completed').length

    if (successCount === 0) {
      // 4 张全失败 → 退款
      await updateProjectStatus(project.id, 'failed', 'All 4 body parts failed')
      await safeRefund(userId, CREDITS_PER_GENERATION)
      return NextResponse.json(
        {
          projectId: project.id,
          tattooDesignUrl: tattoo.r2Url,
          images: fusionResults.map((r) => ({
            bodyPart: r.bodyPart,
            status: r.status,
            url: r.image?.r2Url ?? null,
            error: r.error,
          })),
          error: 'All generations failed, credits refunded',
        },
        { status: 500 }
      )
    }

    // 至少 1 张成功 → 视为成功
    await updateProjectStatus(project.id, 'completed')
    return NextResponse.json({
      projectId: project.id,
      tattooDesignUrl: tattoo.r2Url,
      images: fusionResults.map((r) => ({
        bodyPart: r.bodyPart,
        status: r.status,
        url: r.image?.r2Url ?? null,
        error: r.error,
      })),
    })
  } catch (e) {
    // Step 1 失败 / 其他未预期错误
    console.error('[generate] AI flow failed:', e)
    const errorMessage = e instanceof Error ? e.message : String(e)
    await updateProjectStatus(project.id, 'failed', errorMessage)
    await safeRefund(userId, CREDITS_PER_GENERATION)
    return NextResponse.json(
      { error: 'Generation failed', detail: errorMessage },
      { status: 500 }
    )
  }
}

/** 安全退款：即使退款本身失败也不抛错，只记日志（避免吞掉原始错误） */
async function safeRefund(userId: string, amount: number): Promise<void> {
  try {
    await refundCredits(userId, amount)
  } catch (e) {
    console.error('[generate] safeRefund FAILED — credits not returned to user:', e)
  }
}
