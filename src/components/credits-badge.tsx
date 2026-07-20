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
  /** 上一次 props.credits 的值，用于检测同组件实例内的变化 */
  prev: number | null
  /** 是否处于高亮态（数字刚变化后短暂高亮） */
  highlight: boolean
  /** 最近一次变化的差值（>0 表示增加，触发浮动 "+N" 动画） */
  lastDelta: number
  /** 动画 ID（每次 start/forceDelta +1，用作 React key 强制重触发 CSS 动画） */
  animationId: number
}

type Action =
  | { type: 'init'; value: number }
  | { type: 'start'; from: number; to: number }
  | { type: 'forceDelta'; amount: number }
  | { type: 'tick'; value: number }
  | { type: 'stopHighlight' }

const initialState: State = {
  display: null,
  prev: null,
  highlight: false,
  lastDelta: 0,
  animationId: 0,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'init':
      // 首次拿到值（同一组件实例内）：直接显示，无动画
      return {
        display: action.value,
        prev: action.value,
        highlight: false,
        lastDelta: 0,
        animationId: state.animationId,
      }
    case 'start':
      // 同一组件实例内 credits 变化：count-up + 高亮 + 浮动 +N
      return {
        display: state.display ?? action.from,
        prev: action.to,
        highlight: true,
        lastDelta: action.to - action.from,
        animationId: state.animationId + 1,
      }
    case 'forceDelta':
      // 来自 PaymentFeedback 的事件（用户付款跳回主页，组件重新挂载，
      // sessionStorage/state.prev 都不可靠，所以用 URL 参数的 delta 直接触发）
      return {
        ...state,
        highlight: true,
        lastDelta: action.amount,
        animationId: state.animationId + 1,
      }
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
 * - loading 时显示 "…"，error/null 时显示 "—"
 * - 同一组件实例内 credits 变化：count-up 滚动 + 高亮 + 浮动 "+N"
 * - 跨页面跳转（付款跳回主页）：监听 window 'credits:added' 事件，
 *   由 PaymentFeedback 通过 URL 参数触发，delta 直接来自 URL，绝对准确
 */
export function CreditsBadge({ credits, loading }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState)

  // credits 变化驱动（同一组件实例内）：count-up + 浮动 +N
  useEffect(() => {
    // loading（credits=null）：等 fetch 完成
    if (credits === null) return

    // 值未变化：不动
    if (state.prev === credits) return

    // 首次拿到值：直接 init，无动画
    if (state.prev === null) {
      dispatch({ type: 'init', value: credits })
      return
    }

    // 数字变化：启动 count-up 动画 + 高亮 + 浮动 +N
    const from = state.prev
    const to = credits
    dispatch({ type: 'start', from, to })

    const duration = 800 // ms
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      const value = Math.round(from + (to - from) * eased)
      dispatch({ type: 'tick', value })
      if (progress >= 1) {
        clearInterval(timer)
        window.setTimeout(() => dispatch({ type: 'stopHighlight' }), 1200)
      }
    }, 16) // ~60fps

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits])

  // 监听 PaymentFeedback 的事件（跨页面跳转触发动画）
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ amount: number }>).detail
      if (!detail || typeof detail.amount !== 'number') return
      if (detail.amount <= 0) return
      dispatch({ type: 'forceDelta', amount: detail.amount })
      // 浮动 +N 动画持续 1.5s（CSS），高亮也跟着 1.5s 后淡出
      window.setTimeout(() => dispatch({ type: 'stopHighlight' }), 1500)
    }
    window.addEventListener('credits:added', handler)
    return () => window.removeEventListener('credits:added', handler)
  }, [])

  // 浮动 "+N" 只在数字增加时显示（减少时不显示，避免误导）
  const showFloatingDelta = state.highlight && state.lastDelta > 0

  return (
    <Card
      className={`relative border-border/50 bg-background/60 px-3 py-2 backdrop-blur transition-all duration-300 ${
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
          {loading ? '…' : state.display ?? credits ?? '—'}
        </span>
      </CardContent>

      {showFloatingDelta && (
        <span
          key={state.animationId}
          className="credits-float-up pointer-events-none absolute -top-1 right-1 text-sm font-bold text-primary"
          aria-hidden="true"
        >
          +{state.lastDelta}
        </span>
      )}
    </Card>
  )
}
