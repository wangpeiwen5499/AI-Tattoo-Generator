'use client'

import { useCallback, useEffect, useState } from 'react'

type CreditsState = {
  credits: number | null
  loading: boolean
  error: string | null
}

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

  useEffect(() => {
    void (async () => {
      await refresh()
    })()
  }, [refresh])

  return { ...state, refresh }
}
