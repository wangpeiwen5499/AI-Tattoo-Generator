'use client'

import { Card, CardContent } from '@/components/ui/card'

type Props = {
  credits: number | null
  loading: boolean
}

/**
* 右上角小卡片：显示当前 credits 余额。
* loading 时显示骨架占位，error/null 时显示 "—"。
*/
export function CreditsBadge({ credits, loading }: Props) {
  return (
    <Card className="border-border/50 bg-background/60 px-3 py-2 backdrop-blur">
      <CardContent className="flex items-center gap-2 p-0">
        <span className="text-xs font-medium text-muted-foreground">Credits</span>
        <span
          className="text-sm font-semibold tabular-nums"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? '…' : credits ?? '—'}
        </span>
      </CardContent>
    </Card>
  )
}
