'use client'

import { useEffect, useReducer } from 'react'
import { Card, CardContent } from '@/shared/components/ui/card'

type Props = {
  credits: number | null
  loading: boolean
}

type State = {
  display: number | null
  prev: number | null
  highlight: boolean
  lastDelta: number
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
      return {
        display: action.value,
        prev: action.value,
        highlight: false,
        lastDelta: 0,
        animationId: state.animationId,
      }
    case 'start':
      return {
        display: state.display ?? action.from,
        prev: action.to,
        highlight: true,
        lastDelta: action.to - action.from,
        animationId: state.animationId + 1,
      }
    case 'forceDelta':
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

export function CreditsBadge({ credits, loading }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState)

  useEffect(() => {
    if (credits === null) return
    if (state.prev === credits) return

    if (state.prev === null) {
      dispatch({ type: 'init', value: credits })
      return
    }

    const from = state.prev
    const to = credits
    dispatch({ type: 'start', from, to })

    const duration = 800
    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const value = Math.round(from + (to - from) * eased)
      dispatch({ type: 'tick', value })
      if (progress >= 1) {
        clearInterval(timer)
        window.setTimeout(() => dispatch({ type: 'stopHighlight' }), 1200)
      }
    }, 16)

    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credits])

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
        <span className="text-sm font-semibold tabular-nums" aria-live="polite" aria-busy={loading}>
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
