import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getActor } from '@/server/auth/actor'
import { ensureUser, ensureGuest } from '@/server/db/ensure-user'
import { getCredits } from '@/server/db/queries'
import type { CreditsResponse } from '@/types'

/**
 * GET /api/credits
 *
 * 返回当前身份（登录 userId / 游客 guest_id）的 credits 余额。
 * 副作用：首次调用 ensureUser/ensureGuest 建行（注册送 3 / 游客送 1）。
 *
 * 响应：200 { credits: number } / 500 服务端错误
 */
export async function GET(): Promise<Response> {
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json({ error: 'Failed to identify session' }, { status: 500 })
  }

  try {
    if (actor.type === 'user') {
      const user = await currentUser()
      const email = user?.emailAddresses?.[0]?.emailAddress
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required. Please add an email in your account.' },
          { status: 400 }
        )
      }
      await ensureUser(actor.id, email)
    } else {
      await ensureGuest(actor.id)
    }
  } catch (e) {
    console.error('[credits] ensureUser/Guest failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  try {
    const credits = await getCredits(actor.id)
    return NextResponse.json({ credits } satisfies CreditsResponse)
  } catch (e) {
    console.error('[credits] getCredits failed:', e)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
