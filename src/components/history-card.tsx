import { BODY_PARTS, BODY_PART_LABELS } from '@/lib/constants'
import { getPublicUrl } from '@/lib/r2'
import { HistoryImageDialog } from '@/components/history-image-dialog'
import type { ProjectWithGenerations } from '@/types'

/**
 * 单条历史卡片（Server Component）。
 *
 * 布局：
 *   ┌─────────────────────────────────────────────┐
 *   │  "prompt 文字"           时间 · N/4          │  ← 头部静态文本
 *   │  ┌────────┐  ┌────┐ ┌────┐                  │
 *   │  │ design │  │L.A │ │R.A │                  │  ← HistoryImageDialog
 *   │  │  1:1   │  └────┘ └────┘                  │     （Client 子组件）
 *   │  │        │  ┌────┐ ┌────┐                  │
 *   │  │        │  │Shol│ │Calf│                  │
 *   │  └────────┘  └────┘ └────┘                  │
 *   └─────────────────────────────────────────────┘
 *
 * 静态文本（prompt / 时间 / 部位 label）由本组件渲染，
 * 所有图片相关交互（缩略图 + Dialog）委托给 HistoryImageDialog。
 */
export function HistoryCard({ project }: { project: ProjectWithGenerations }) {
  // 按 BODY_PARTS 顺序排列 generations（DB 返回顺序不保证）
  const bodyPartThumbs = BODY_PARTS.map((part) => {
    const gen = project.generations.find((g) => g.body_part === part)
    const label = BODY_PART_LABELS[part]
    return {
      label,
      url: gen?.result_image_url ?? null,
    }
  })

  // 纹身设计稿 key 由 4 条 generations 共享，取第一条的 tattoo_image_key
  const tattooDesignKey = project.generations[0]?.tattoo_image_key ?? null
  const tattooDesignUrl = tattooDesignKey ? getPublicUrl(tattooDesignKey) : null

  // 成功部位数
  const successCount = bodyPartThumbs.filter((bp) => bp.url !== null).length

  const createdLabel = new Date(project.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <article className="rounded-xl border border-border/50 bg-card p-5 shadow-sm">
      <header className="mb-4 flex items-start justify-between gap-4">
        <p className="line-clamp-2 flex-1 text-sm font-medium text-foreground">
          &ldquo;{project.prompt}&rdquo;
        </p>
        <div className="flex flex-shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
          <time dateTime={project.created_at}>{createdLabel}</time>
          <span>
            {successCount}/{BODY_PARTS.length} succeeded
          </span>
        </div>
      </header>

      <HistoryImageDialog
        tattooDesignUrl={tattooDesignUrl}
        bodyParts={bodyPartThumbs}
      />
    </article>
  )
}
