'use client'

import { useEffect, useReducer } from 'react'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  credits: number | null
  loading: boolean
}

type State = {
  /** 当前显示的数字（动画过程中会平滑变化） */
  display: number | null
  /** 上一次 props.credits 的值，用于检测变化 */
  prev: number | null
  /** 是否处于高亮态（数字刚变化后短暂高亮） */
  highlight: boolean
}

type Action =
  | { type: 'reset' }
  | { type: 'init'; value: number }
  | { type: 'start'; from: number; to: number }
  | { type: 'tick'; value: number }
  | { type: 'stopHighlight' }

const initialState: State = {
  display: null,
  prev: null,
  highlight: false,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { display: null, prev: null, highlight: false }
    case 'init':
      return { display: action.value, prev: action.value, highlight: false }
    case 'start':
      // 启动动画：记下新目标值，开高亮；display 仍保持旧值，由 tick 渐进到 to
      return { display: state.display, prev: action.to, highlight: true }
    case 'tick':
      return { ...state, display: action.value }
    case 'stopHighlight':
      return { ...state, highlight: false }
    default:
      return state
  }
}

/**
 * 右上角小卡片：显示当前 credits 余额。
 *
 * 行为：
 * - loading 时显示骨架占位，error/null 时显示 "—"
 * - credits 变化时做 count-up 滚动动效（800ms ease-out）+ 短暂高亮
 *   （让用户付完款回来能醒目地看到加了几个 credits）
 */
export function CreditsBadge({ credits, loading }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    // null 或 loading：重置
    if (credits === null) {
      dispatch({ type: 'reset' })
      return
    }

    // 首次拿到值：直接显示，不做动画
    if (state.prev === null) {
      dispatch({ type: 'init', value: credits })
      return
    }

    // 值未变化：不动
    if (state.prev === credits) return

    // 值变化：启动 count-up 动画 + 高亮
    const from = state.prev
    const to = credits
    dispatch({ type: 'start', from, to })

    const duration = 800 // ms
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic：先快后慢，更自然
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round(from + (to - from) * eased)
      dispatch({ type: 'tick', value })
      if (progress >= 1) {
        clearInterval(timer)
        // 高亮保留一会儿再淡出
        window.setTimeout(() => dispatch({ type: 'stopHighlight' }), 1200)
      }
    }, 16) // ~60fps

    return () => clearInterval(timer)
    // 故意不依赖 state.prev（dispatch 是稳定的，state.prev 通过 reducer 内部更新）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits])

  return (
    <Card
      className={`border-border/50 bg-background/60 px-3 py-2 backdrop-blur transition-all duration-300 ${
        state.highlight
          ? 'border-primary scale-110 bg-primary/10 ring-2 ring-primary/40'
          : ''
      }`}
    >
      <CardContent className="flex items-center gap-2 p-0">
        <span className="text-xs font-medium text-muted-foreground">Credits</span>
        <span
          className="text-sm font-semibold tabular-nums"
          aria-live="polite"
          aria-busy={loading}
        >
          {loading ? '…' : state.display ?? '—'}
        </span>
      </CardContent>
    </Card>
  )
}
