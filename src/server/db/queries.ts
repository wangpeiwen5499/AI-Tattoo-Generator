import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { ProjectRow, UserRow } from '@/types'

/**
 * 数据库查询封装（服务端专用，配合 service_role key）。
 * Day 2 只放最小集合：getCredits。
 * Day 3 会扩充 createProject / recordGeneration / updateProjectStatus 等。
 */

/** 获取用户的当前 credits 余额 */
export async function getCredits(userId: string): Promise<number> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single<UserRow>()

  if (error) throw error
  if (!data) throw new Error(`getCredits: user ${userId} not found (call ensureUser first)`)
  return data.credits
}

/** 拉取单条 project（带权限校验：必须属于该用户） */
export async function getProjectForUser(projectId: string, userId: string): Promise<ProjectRow | null> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .maybeSingle<ProjectRow>()

  if (error) throw error
  return data
}
