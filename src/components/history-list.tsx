import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HistoryCard } from '@/components/history-card'
import type { ProjectWithGenerations } from '@/types'

/**
 * 历史列表容器（Server Component）。
 *
 * - 有记录：标题 + 数量 + HistoryCard 列表
 * - 空状态：图标 + 文案 + CTA 跳首页
 */
export function HistoryList({ projects }: { projects: ProjectWithGenerations[] }) {
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
        <Sparkles className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold">No tattoos yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate your first AI tattoo to see it here.
          </p>
        </div>
        <Link href="/">
          <Button>Create Tattoo</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your Tattoos</h1>
        <span className="text-sm text-muted-foreground">
          {projects.length} {projects.length === 1 ? 'creation' : 'creations'}
        </span>
      </header>

      <div className="flex flex-col gap-6">
        {projects.map((project) => (
          <HistoryCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  )
}
