import { auth, currentUser } from '@clerk/nextjs/server'
import { RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HistoryList } from '@/components/history-list'
import { ensureUser } from '@/server/db/ensure-user'
import { listProjects } from '@/server/db/queries'
import type { ProjectWithGenerations } from '@/types'

export const metadata = {
  title: 'History — AI Tattoo Generator',
  description: 'View your past AI tattoo generations.',
}

/**
 * /history 历史记录页。
 *
 * middleware 已保护本路由（未登录跳 sign-in），所以这里假设已登录。
 * 即便如此，仍防御性检查 auth() / currentUser()，避免边缘情况。
 *
 * 流程：
 *   1. auth() → userId（未登录理论上不会到这里，但兜底）
 *   2. ensureUser → 确保数据库存在该用户记录
 *   3. listProjects → 查所有 completed projects
 *   4. 渲染 HistoryList（含空状态）
 *
 * 错误兜底：任何步骤失败渲染友好错误页 + Retry 按钮。
 *
 * 注意：React 19 lint 规则 react-hooks/error-boundaries 禁止在 try/catch 内构造 JSX，
 * 所以数据获取和渲染分离——try 只取数据，JSX 在 try 外构造。
 */
export default async function HistoryPage() {
  const { userId } = await auth()
  const user = await currentUser()

  if (!userId || !user) {
    // 理论上 middleware 会拦截；兜底渲染错误提示
    return <HistoryError />
  }

  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return <HistoryError />
  }

  let projects: ProjectWithGenerations[] | null = null
  try {
    await ensureUser(userId, email)
    projects = await listProjects(userId)
  } catch (e) {
    console.error('[/history] failed to load:', e)
  }

  if (projects === null) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
        <HistoryError />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:py-16">
      <HistoryList projects={projects} />
    </div>
  )
}

function HistoryError() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
      <RotateCcw className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <div>
        <h2 className="text-lg font-semibold">Something went wrong</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn&apos;t load your history. Please try again.
        </p>
      </div>
      <Link href="/history">
        <Button variant="outline">Retry</Button>
      </Link>
    </div>
  )
}
