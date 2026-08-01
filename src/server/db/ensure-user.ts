import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { UserRow } from '@/types'

/**
 * 确保数据库存在该 Clerk 用户的记录。
 * Clerk 不走 Supabase Auth，所以用户首次调用任何 API 时，
 * 这里负责把 Clerk user id + email 写入 public.users 表。
 *
 * 用 onConflict: 'id' 实现「不存在则插入，存在则返回该行」。
 * ⚠️ 不能用 ignoreDuplicates: true，那会让已存在的用户返回 0 行，
 *    配合 .single() 会抛 PGRST116 错误。
 * 新用户的 credits 列在 schema 中 default 1（注册送 1 次免费）。
 *
 * 返回当前数据库中的用户记录（含最新 credits）。
 */
export async function ensureUser(clerkUserId: string, email: string): Promise<UserRow> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({ id: clerkUserId, email }, { onConflict: 'id' })
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error(`ensureUser: no row returned for ${clerkUserId}`)
  return data as UserRow
}

/**
 * 确保数据库存在该游客的记录（id = guest_<uuid>，由 cookie 发放）。
 *
 * ⚠️ 必须用 ignoreDuplicates: true：upsert {credits:1} 默认会 update 已存在行，
 *    把游客用完后的 credits=0 重置回 1（刷漏洞）。ignoreDuplicates 让首次
 *    insert 给 credits=1，已存在则不动。
 * email 用占位（users.email not null）。
 */
export async function ensureGuest(guestId: string): Promise<UserRow> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('users')
    .upsert(
      { id: guestId, email: `${guestId}@guest.local`, credits: 1 },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', guestId)
    .single<UserRow>()

  if (error) throw error
  if (!data) throw new Error(`ensureGuest: no row returned for ${guestId}`)
  return data
}
