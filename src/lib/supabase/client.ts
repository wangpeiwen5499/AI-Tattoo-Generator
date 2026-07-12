/**
 * 浏览器侧 Supabase 客户端（占位）。
 *
 * ⚠️ MVP 阶段不从浏览器直接访问 Supabase：所有读写都通过 Next.js API Route
 *    使用 service_role key 完成，避免暴露 anon key 和数据库结构。
 *
 * 此文件预留给未来可能的浏览器侧场景（如实时订阅）。
 * 当前没有任何代码导入它。
 */

export function getBrowserSupabase() {
  throw new Error(
    'Browser Supabase client is intentionally disabled in MVP. ' +
      'Use the API routes instead — they run server-side with service_role key.'
  )
}
