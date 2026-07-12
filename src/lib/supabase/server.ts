import { createClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * 服务端 Supabase 客户端（使用 service_role key，绕过 RLS）。
 *
 * ⚠️ 只能在服务端使用（API Route / Server Components / Server Actions）。
 *    service_role key 拥有完全数据库访问权限，绝不能暴露到浏览器。
 *
 * MVP 中真正的鉴权发生在 API 层：先验证 Clerk session，
 * 再检查 userId 匹配，不依赖 RLS。
 */

let cachedClient: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedClient) return cachedClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: {
      // 我们不用 Supabase Auth，关闭 autoRefresh 和 session 持久化
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })

  return cachedClient
}

/**
 * 在函数体内调用的便捷方法：返回当前请求共享的 client。
 * 用法：`const db = getSupabaseAdmin()`
 *
 * 不要在模块顶层调用 getSupabaseAdmin()，
 * 因为 build 时环境变量可能尚未注入，会导致编译失败。
 */
