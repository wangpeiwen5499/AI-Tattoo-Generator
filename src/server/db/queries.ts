import { getSupabaseAdmin } from '@/lib/supabase/server'
import type { GenerationRow, ProjectRow, UserRow } from '@/types'

/**
 * 数据库查询封装（服务端专用，配合 service_role key）。
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

/**
 * 创建一条 project 记录（status='processing'）。
 * 调用时机：扣完 credits 之后、调 AI 之前。
 */
export async function createProject(input: {
  userId: string
  bodyPhotoKey: string
  bodyPhotoUrl: string
  prompt: string
}): Promise<ProjectRow> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      user_id: input.userId,
      body_photo_key: input.bodyPhotoKey,
      body_photo_url: input.bodyPhotoUrl,
      prompt: input.prompt,
      status: 'processing',
    })
    .select()
    .single<ProjectRow>()

  if (error) throw error
  if (!data) throw new Error('createProject: no row returned')
  return data
}

/**
 * 批量插入 generations（一次 project 下 4 条）。
 * tattoo_image_key 由 4 条共享（Step 1 的纹身图案）。
 */
export async function recordGenerations(
  projectId: string,
  userId: string,
  tattooImageKey: string,
  results: Array<{
    bodyPart: string
    status: 'completed' | 'failed'
    resultImageKey: string | null
    resultImageUrl: string | null
  }>
): Promise<GenerationRow[]> {
  const supabaseAdmin = getSupabaseAdmin()
  const rows = results.map((r) => ({
    project_id: projectId,
    user_id: userId,
    body_part: r.bodyPart,
    tattoo_image_key: tattooImageKey,
    result_image_key: r.resultImageKey,
    result_image_url: r.resultImageUrl,
    status: r.status,
  }))
  const { data, error } = await supabaseAdmin.from('generations').insert(rows).select()
  if (error) throw error
  return (data ?? []) as GenerationRow[]
}

/**
 * 更新 project 状态。completed 时自动写 completed_at。
 */
export async function updateProjectStatus(
  projectId: string,
  status: 'completed' | 'failed',
  errorMessage?: string | null
): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const update: Record<string, unknown> = { status }
  if (status === 'completed') update.completed_at = new Date().toISOString()
  if (errorMessage !== undefined) update.error_message = errorMessage

  const { error } = await supabaseAdmin.from('projects').update(update).eq('id', projectId)
  if (error) throw error
}

/**
 * 扣减 credits（调用 deduct_credits RPC，原子操作）。
 * 余额不足时 RPC 抛 'Insufficient credits'，事务回滚。
 */
export async function deductCredits(userId: string, amount: number): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.rpc('deduct_credits', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (error) throw error
}

/**
 * 退还 credits（AI 流程失败时调用，调用 add_credits RPC）。
 */
export async function refundCredits(userId: string, amount: number): Promise<void> {
  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: amount,
  })
  if (error) throw error
}
