/**
 * 后台执行生成（由 /api/generate 的 after() 在响应发出后触发）。
 *
 * 关键约束：调用方（after 回调）的错误无法再通过 HTTP 返回客户端，
 * 所以本函数必须自己 try/catch —— 任何失败都把 project 标 failed 并退款，
 * 绝不让错误默默吞掉、也绝不向外抛出。
 *
 * 退款策略（与原同步 route 一致）：
 *   - Step 1 抛错 / 未预期异常 → project=failed + 全额退款
 *   - 4 部位全失败              → project=failed + 全额退款
 *   - ≥1 张成功                 → project=completed（不退款，用户已拿到价值）
 */
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { generateTattooDesign } from './generate-tattoo'
import { applyTattooToBody } from './apply-to-body'
import {
  recordGenerations,
  updateProjectStatus,
  refundCredits,
} from '@/server/db/queries'

export interface RunGenerationInput {
  projectId: string
  userId: string
  bodyPhotoUrl: string
  prompt: string
}

export async function runGeneration(input: RunGenerationInput): Promise<void> {
  const { projectId, userId, bodyPhotoUrl, prompt } = input
  try {
    // Step 1：生成纹身图案
    const tattoo = await generateTattooDesign({ prompt, userId, projectId })

    // Step 2：4 部位并发融合（单部位失败落 result，不抛错）
    const fusionResults = await applyTattooToBody({
      bodyPhotoUrl,
      tattooDesignUrl: tattoo.r2Url,
      userId,
      projectId,
    })

    // 入库 4 条 generations（共享 Step 1 的 tattoo_image_key）
    await recordGenerations(
      projectId,
      userId,
      tattoo.r2Key,
      fusionResults.map((r) => ({
        bodyPart: r.bodyPart,
        status: r.status,
        resultImageKey: r.image?.r2Key ?? null,
        resultImageUrl: r.image?.r2Url ?? null,
      }))
    )

    // 判断整体状态
    const successCount = fusionResults.filter((r) => r.status === 'completed').length
    if (successCount === 0) {
      await updateProjectStatus(projectId, 'failed', 'All 4 body parts failed')
      await safeRefund(userId)
    } else {
      await updateProjectStatus(projectId, 'completed')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[runGeneration] failed:', msg)
    await updateProjectStatus(projectId, 'failed', msg)
    await safeRefund(userId)
  }
}

/** 安全退款：退款本身失败也不抛错，只记日志（避免吞掉上层错误） */
async function safeRefund(userId: string): Promise<void> {
  try {
    await refundCredits(userId, CREDITS_PER_GENERATION)
  } catch (e) {
    console.error('[runGeneration] refund FAILED — credits not returned:', e)
  }
}
