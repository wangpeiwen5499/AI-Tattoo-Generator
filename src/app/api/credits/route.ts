/**
 * GET /api/credits
 *
 * 返回当前登录用户的剩余 Credits 余额。
 */
import { NextResponse } from 'next/server';

import { getSignUser } from '@/shared/models/user';
import { getRemainingCredits } from '@/shared/models/credit';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  const user = await getSignUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const credits = await getRemainingCredits(user.id);
    return NextResponse.json({ credits });
  } catch (e) {
    console.error('[credits] getRemainingCredits failed:', e);
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 });
  }
}
