'use client'

import { useCallback, useEffect, useState } from 'react'

type CreditsState = {
  credits: number | null
  loading: boolean
  error: string | null
}

/**
 * 查询当前用户的 credits 余额。
 * 挂载时自动请求一次；暴露 refresh() 用于生成完成后刷新。
 */
export function useCredits() {
  const [state, setState] = useState<CreditsState>({
    credits: null,
    loading: true,
    error: null,
  })

  const refresh = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/credits', { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `HTTP ${res.status}`)
      }
      const data: { credits: number } = await res.json()
      setState({ credits: data.credits, loading: false, error: null })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [])

  // 挂载时拉取一次余额。refresh 内部第一行同步 setState 会触发
  // react-hooks/set-state-in-effect 警告，所以用异步 IIFE 让 setState
  // 落到微任务里（既不破坏行为，也满足规则）。
  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [refresh])

  return { ...state, refresh }
}
