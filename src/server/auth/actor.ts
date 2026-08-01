import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

export type Actor =
  | { type: 'user'; id: string } // Clerk userId
  | { type: 'guest'; id: string } // guest_id cookie（guest_<uuid>）

/**
 * 统一身份：登录用 Clerk userId，未登录用 guest_id cookie。
 * 用于 Route Handler（用 next/headers cookies()）；middleware 单独用 req.cookies。
 * 返回 null = 无任何身份（middleware 应已发 cookie，罕见）。
 */
export async function getActor(): Promise<Actor | null> {
  const { userId } = await auth()
  if (userId) return { type: 'user', id: userId }

  const cookieStore = await cookies()
  const guestId = cookieStore.get('guest_id')?.value
  if (guestId) return { type: 'guest', id: guestId }

  return null
}
