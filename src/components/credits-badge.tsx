'use client'

import { useEffect, useReducer } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent } from '@/components/ui/card'

type Props = {
  credits: number | null
  loading: boolean
}

type State = {
  /** 当前显示的数字（动画过程中会平滑变化） */
  display: number | null
  /** 上一次 props.credits 的值，用于检测变化（从 sessionStorage 初始化） */
  prev: number | null
  /** 是否处于高亮态（数字刚变化后短暂高亮） */
  highlight: boolean
  /** 最近一次变化的差值（>0 表示增加，触发浮动 "+N" 动画） */
  lastDelta: number
  /** 动画 ID（每次 start +1，用作 React key 强制重触发 CSS 动画） */
  animationId: number
}

type Action =
  | { type: 'init'; value: number }
  | { type: 'start'; from: number; to: number }
  | { type: 'tick'; value: number }
  | { type: 'stopHighlight' }

/**
 * 按用户 ID 隔离的 sessionStorage 读写。
 * 用户切换账号时不会串扰。
 */
function readLastValue(userId: string): number | null {
  if (typeof window === 'undefined') return null
  const raw = window.sessionStorage.getItem(`creditsBadge.lastValue.${userId}`)
  if (raw === null) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

function writeLastValue(userId: string, value: number) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(`creditsBadge.lastValue.${userId}`, String(value))
}

function makeInit(userId: string): State {
  const last = readLastValue(userId)
  return {
    display: last, // 挂载时先显示上次的值（loading 时被 '…' 覆盖，loading=false 时露出来）
    prev: last,
    highlight: false,
    lastDelta: 0,
    animationId: 0,
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'init':
      // 首次设置（无动画）：用户首次注册 / sessionStorage 无值
      return {
        display: action.value,
        prev: action.value,
        highlight: false,
        lastDelta: 0,
        animationId: state.animationId,
      }
    case 'start':
      // 启动动画：display 保持（用 from 兜底），prev 更新为目标值，开高亮
      return {
        display: state.display ?? action.from,
        prev: action.to,
        highlight: true,
        lastDelta: action.to - action.from,
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
 * - credits 增加时做 count-up 滚动动效（800ms ease-out）+ 短暂高亮
 *   + 浮动 "+N" 文字飘起来（1.5s）
 *   （让用户付完款回来能醒目地看到加了几个 credits）
 *
 * 跨页面跳转持久化：
 *   用户付完款从 Stripe 跳回主页会触发组件重新挂载，React state 丢失。
 *   用 sessionStorage 缓存上次的值，挂载时初始化 prev，从而识别出
 *   "从旧值到新值" 的变化并播放动画。
 */
export function CreditsBadge({ credits, loading }: Props) {
  const { user } = useUser()
  const userId = user?.id ?? 'anonymous'

  const [state, dispatch] = useReducer(reducer, userId, makeInit)

  useEffect(() => {
    // loading（credits=null）：等 fetch 完成，不动 state
    if (credits === null) return

    // 值未变化：不动
    if (state.prev === credits) {
      // 同步缓存（防止首次写入）
      writeLastValue(userId, credits)
      return
    }

    // 首次拿到值（sessionStorage 无缓存）：直接 init，无动画
    if (state.prev === null) {
      writeLastValue(userId, credits)
      dispatch({ type: 'init', value: credits })
      return
    }

    // 数字变化：启动 count-up 动画 + 高亮
    const from = state.prev
    const to = credits
    writeLastValue(userId, to)
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
        // 高亮保留一会儿再淡出（浮动 +N 持续 1.5s，比高亮长一点）
        window.setTimeout(() => dispatch({ type: 'stopHighlight' }), 1200)
      }
    }, 16) // ~60fps

    return () => clearInterval(timer)
    // state.prev 不进依赖（dispatch 稳定，prev 通过 reducer 内部更新）
    // userId 变化会触发组件 re-mount（Clerk 状态切换），不需要单独处理
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits, userId])

  // 浮动 "+N" 在数字增加时显示（减少时不显示，避免误导）
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
          {loading ? '…' : state.display ?? '—'}
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
