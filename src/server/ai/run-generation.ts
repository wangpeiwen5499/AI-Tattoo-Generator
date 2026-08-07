/**
 * 后台执行生成（由 /api/ai/generate-tattoo 的 after() 在响应发出后触发）。
 *
 * 关键约束：调用方（after 回调）的错误无法再通过 HTTP 返回客户端，
 * 所以本函数必须自己 try/catch —— 任何失败都把 project 标 failed 并退款。
 *
 * 退款策略：
 *   - Step 1 抛错 / 未预期异常 → project=failed + 全额退款
 *   - 4 部位全失败              → project=failed + 全额退款
 *   - ≥1 张成功                 → project=completed（不退款）
 */
import { CREDITS_PER_GENERATION } from '@/lib/constants';
import { generateTattooDesign } from './generate-tattoo';
import { applyTattooToBody } from './apply-to-body';
import {
  recordTattooGeneration,
  updateTattooProjectStatus,
  updateTattooProjectDesign,
} from '@/server/db/tattoo-queries';
import {
  createCredit,
  CreditStatus,
  CreditTransactionType,
  CreditTransactionScene,
} from '@/shared/models/credit';
import { getUuid, getSnowId } from '@/shared/lib/hash';

export interface RunGenerationInput {
  projectId: string;
  userId: string;
  bodyPhotoUrl: string;
  prompt: string;
}

export async function runGeneration(input: RunGenerationInput): Promise<void> {
  const { projectId, userId, bodyPhotoUrl, prompt } = input;
  try {
    // Step 1：生成纹身图案
    const tattoo = await generateTattooDesign({ prompt, userId, projectId });
    await updateTattooProjectDesign(projectId, tattoo.r2Key, tattoo.r2Url);

    // Step 2：4 部位并发融合（单部位失败落 result，不抛错）
    const fusionResults = await applyTattooToBody({
      bodyPhotoUrl,
      tattooDesignUrl: tattoo.r2Url,
      userId,
      projectId,
    });

    // 入库 4 条 generations
    for (const r of fusionResults) {
      await recordTattooGeneration({
        projectId,
        bodyPart: r.bodyPart,
        r2Key: r.image?.r2Key ?? null,
        r2Url: r.image?.r2Url ?? null,
        status: r.status,
        error: r.error,
      });
    }

    // 判断整体状态
    const successCount = fusionResults.filter((r) => r.status === 'completed').length;
    if (successCount === 0) {
      await updateTattooProjectStatus(projectId, 'failed');
      await safeRefund(userId);
    } else {
      await updateTattooProjectStatus(projectId, 'completed');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[runGeneration] failed:', msg);
    try {
      await updateTattooProjectStatus(projectId, 'failed');
    } catch {}
    await safeRefund(userId);
  }
}

/** 安全退款：退款本身失败也不抛错 */
async function safeRefund(userId: string): Promise<void> {
  try {
    await createCredit({
      id: getUuid(),
      userId,
      userEmail: '',
      transactionNo: getSnowId(),
      transactionType: CreditTransactionType.GRANT,
      transactionScene: CreditTransactionScene.REWARD,
      credits: CREDITS_PER_GENERATION,
      remainingCredits: CREDITS_PER_GENERATION,
      description: 'Refund for failed tattoo generation',
      expiresAt: null,
      status: CreditStatus.ACTIVE,
    });
  } catch (e) {
    console.error('[runGeneration] refund FAILED — credits not returned:', e);
  }
}
