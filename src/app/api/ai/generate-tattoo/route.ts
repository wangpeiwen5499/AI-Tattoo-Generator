/**
 * POST /api/ai/generate-tattoo
 *
 * 触发纹身 AI 生成（异步模式）。
 * 登录用户：扣积分 → 生成 → 失败退款
 * 游客：IP 限流（3次/天）→ 免费生成（不涉及积分系统）
 *
 * 请求体：{ bodyPhotoKey, bodyPhotoUrl, prompt }
 * 响应：{ projectId }
 */
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { getActor } from '@/server/auth/actor';
import {
  getRemainingCredits,
  consumeCredits,
  createCredit,
  CreditStatus,
  CreditTransactionType,
  CreditTransactionScene,
} from '@/shared/models/credit';
import { createTattooProject } from '@/server/db/tattoo-queries';
import { claimGuestFree } from '@/server/db/guest-queries';
import { runGeneration } from '@/server/ai/run-generation';
import { getUuid, getSnowId } from '@/shared/lib/hash';
import { CREDITS_PER_GENERATION } from '@/lib/constants';

export const dynamic = 'force-dynamic';

const MAX_PROMPT_LENGTH = 500;

export async function POST(req: Request) {
  // 1. 身份：登录用户 / 游客
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = actor.id;
  const isGuest = actor.type === 'guest';

  // 2. 解析请求体
  let body: { bodyPhotoKey?: string; bodyPhotoUrl?: string; prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { bodyPhotoKey, bodyPhotoUrl, prompt } = body;
  if (!bodyPhotoKey || !bodyPhotoUrl || !prompt) {
    return NextResponse.json(
      { error: 'Missing required fields: bodyPhotoKey, bodyPhotoUrl, prompt' },
      { status: 400 }
    );
  }
  if (typeof prompt !== 'string' || prompt.trim().length === 0) {
    return NextResponse.json({ error: 'prompt must be non-empty' }, { status: 400 });
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: `Prompt too long. Max ${MAX_PROMPT_LENGTH} chars.` },
      { status: 400 }
    );
  }

  // 3. 游客：IP 限流检查
  if (isGuest) {
    try {
      const fwd = (await headers()).get('x-forwarded-for');
      const ip = fwd?.split(',')[0]?.trim() || 'unknown';
      const claimed = await claimGuestFree(ip);
      if (claimed === -1) {
        return NextResponse.json(
          { error: 'Guest free limit reached for today. Sign up for 3 more previews.' },
          { status: 429 }
        );
      }
    } catch (e) {
      console.error('[generate-tattoo] claimGuestFree failed:', e);
      return NextResponse.json({ error: 'Failed to check guest limit' }, { status: 500 });
    }
  } else {
    // 4. 登录用户：余额检查 + 扣积分
    let credits: number;
    try {
      credits = await getRemainingCredits(userId);
    } catch (e) {
      console.error('[generate-tattoo] getRemainingCredits failed:', e);
      return NextResponse.json({ error: 'Failed to check credits' }, { status: 500 });
    }
    if (credits < CREDITS_PER_GENERATION) {
      return NextResponse.json(
        { error: 'Insufficient credits', credits },
        { status: 402 }
      );
    }

    try {
      await consumeCredits({
        userId,
        credits: CREDITS_PER_GENERATION,
        scene: CreditTransactionScene.PAYMENT,
        description: `Generate tattoo: ${prompt.trim().slice(0, 60)}`,
      });
    } catch (e: any) {
      console.error('[generate-tattoo] consumeCredits failed:', e.message);
      return NextResponse.json(
        { error: e.message || 'Insufficient credits' },
        { status: 402 }
      );
    }
  }

  // 5. 创建 project
  let projectId: string;
  try {
    projectId = await createTattooProject({
      userId,
      bodyPhotoKey,
      bodyPhotoUrl,
      prompt: prompt.trim(),
    });
  } catch (e) {
    console.error('[generate-tattoo] createTattooProject failed:', e);
    // 非游客才退款（游客没扣分，不用退）
    if (!isGuest) {
      await safeRefund(userId);
    }
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }

  // 6. 后台异步执行 AI 生成（fire-and-forget，不阻塞响应）
  void runGeneration({
    projectId,
    userId,
    bodyPhotoUrl,
    prompt: prompt.trim(),
  }).catch((err) => {
    console.error('[generate-tattoo] background generation crashed:', err);
  });

  return NextResponse.json({ projectId });
}

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
      description: 'Refund for failed project creation',
      expiresAt: null,
      status: CreditStatus.ACTIVE,
    });
  } catch (e) {
    console.error('[generate-tattoo] safeRefund FAILED:', e);
  }
}
