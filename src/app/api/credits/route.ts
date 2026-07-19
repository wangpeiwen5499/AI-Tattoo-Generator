import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import { getCredits } from '@/server/db/queries'
import type { CreditsResponse } from '@/types'

/**
 * GET /api/credits
 *
 * 返回当前 Clerk 用户的 credits 余额。
 * 副作用：首次调用会 ensureUser 创建用户记录（送 1 免费 credit）。
 *
 * 响应：
 *   200 { credits: number }
 *   401 未登录
 *   500 服务端错误
 */
export async function GET(): Promise<Response> {
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
    return NextResponse.json(
      { error: 'Email is required. Please add an email in your account.' },
      { status: 400 }
    )
  }

  try {
    await ensureUser(userId, email)
  } catch (e) {
    console.error('[credits] ensureUser failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  try {
    const credits = await getCredits(userId)
    return NextResponse.json({ credits } satisfies CreditsResponse)
  } catch (e) {
    console.error('[credits] getCredits failed:', e)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
