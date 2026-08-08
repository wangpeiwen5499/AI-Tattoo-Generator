/**
 * GET /api/credits
 *
 * 登录用户：返回剩余 Credits 余额。
 * 游客：返回基于 IP 的剩余免费预览次数（每日限额，与 generate-tattoo 的 IP 限流一致）。
 */
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSignUser } from '@/shared/models/user';
import { getRemainingCredits } from '@/shared/models/credit';
import { getGuestRemaining } from '@/server/db/guest-queries';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await getSignUser();

  // 登录用户：返回 credits 余额
  if (user?.id) {
    try {
      const credits = await getRemainingCredits(user.id);
      return NextResponse.json({ credits });
    } catch (e) {
      console.error('[credits] getRemainingCredits failed:', e);
      return NextResponse.json(
        { error: 'Failed to fetch credits' },
        { status: 500 }
      );
    }
  }

  // 游客：返回基于 IP 的剩余免费预览次数
  try {
    const fwd = (await headers()).get('x-forwarded-for');
    const ip = fwd?.split(',')[0]?.trim() || 'unknown';
    const remaining = await getGuestRemaining(ip);
    return NextResponse.json({ credits: remaining });
  } catch (e) {
    console.error('[credits] getGuestRemaining failed:', e);
    return NextResponse.json(
      { error: 'Failed to fetch guest credits' },
      { status: 500 }
    );
  }
}
