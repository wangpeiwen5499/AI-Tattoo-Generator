'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** POST /api/ai/generate-tattoo 响应 */
interface TriggerResponse {
  projectId: string
  error?: string
}

/** GET /api/ai/generate-tattoo/status 响应 */
interface StatusResponse {
  status: string
  tattooDesignUrl: string | null
  images: Array<{ bodyPart: string; status: string; url: string | null }>
}

/** 前端使用的生成结果 */
export interface GenerateResult {
  projectId: string
  tattooDesignUrl: string | null
  images: Array<{ bodyPart: string; status: string; url: string | null }>
}

export type GenStatus =
  | 'idle'
  | 'uploading'
  | 'ready'
  | 'generating'
  | 'completed'
  | 'error'

export type GenState = {
  status: GenStatus
  uploadProgress: number
  generateProgress: number
  stageLabel: string
  elapsedSeconds: number
  photoKey: string | null
  photoUrl: string | null
  prompt: string
  result: GenerateResult | null
  refunded: boolean
  error: string | null
}

const INITIAL_STATE: GenState = {
  status: 'idle',
  uploadProgress: 0,
  generateProgress: 0,
  stageLabel: '',
  elapsedSeconds: 0,
  photoKey: null,
  photoUrl: null,
  prompt: '',
  result: null,
  refunded: false,
  error: null,
}

const STAGE1_END_SEC = 110
const STAGE2_END_SEC = 250
const PROGRESS_CAP = 95
const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5.5 * 60 * 1000

function computeStage(elapsedSec: number): { label: string; progress: number } {
  if (elapsedSec < STAGE1_END_SEC) {
    const ratio = elapsedSec / STAGE1_END_SEC
    return { label: 'Step 1: Designing your tattoo', progress: ratio * 45 }
  }
  if (elapsedSec < STAGE2_END_SEC) {
    const ratio = (elapsedSec - STAGE1_END_SEC) / (STAGE2_END_SEC - STAGE1_END_SEC)
    return { label: 'Step 2: Placing on body (4 parts in parallel)', progress: 45 + ratio * 45 }
  }
  return { label: 'Almost there, finalizing...', progress: PROGRESS_CAP }
}

export function useGeneration() {
  const [state, setState] = useState<GenState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const elapsedStartRef = useRef<number>(0)

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
      abortRef.current?.abort()
    }
  }, [clearTimers])

  const setPrompt = useCallback((prompt: string) => {
    setState((s) => ({ ...s, prompt }))
  }, [])

  const uploadPhoto = useCallback(async (file: File) => {
    setState((s) => ({
      ...s,
      status: 'uploading',
      uploadProgress: 0,
      error: null,
      result: null,
      refunded: false,
    }))

    if (file.size > 10 * 1024 * 1024) {
      setState((s) => ({ ...s, status: 'idle', error: 'File too large (max 10MB)' }))
      throw new Error('File too large (max 10MB)')
    }

    type UploadUrlResponse = { key: string; uploadUrl: string; publicUrl: string }

    let uploadRes: UploadUrlResponse
    try {
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
          contentLength: file.size,
          ext: file.type.split('/')[1] || 'jpg',
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload URL request failed (HTTP ${res.status})`)
      }
      uploadRes = (await res.json()) as UploadUrlResponse
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, status: 'idle', error: msg }))
      throw e
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState((s) => ({ ...s, uploadProgress: (e.loaded / e.total) * 100 }))
          }
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new Error(`R2 upload failed (HTTP ${xhr.status})`))
        }
        xhr.onerror = () => reject(new Error('R2 upload network error'))
        xhr.open('PUT', uploadRes.uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.send(file)
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setState((s) => ({ ...s, status: 'idle', error: msg }))
      throw e
    }

    setState((s) => ({
      ...s,
      status: 'ready',
      uploadProgress: 100,
      photoKey: uploadRes.key,
      photoUrl: uploadRes.publicUrl,
    }))
  }, [])

  const pollStatus = useCallback(
    (projectId: string): Promise<StatusResponse> => {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now()

        const tick = async () => {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            reject(new Error('Generation timed out. Check /history later.'))
            return
          }

          let data: StatusResponse
          try {
            const res = await fetch(`/api/ai/generate-tattoo/status?id=${projectId}`, {
              signal: abortRef.current?.signal,
            })
            data = (await res.json()) as StatusResponse
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
              reject(e)
              return
            }
            pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
            return
          }

          if (data.status === 'completed' || data.status === 'failed') {
            resolve(data)
            return
          }
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
        }

        tick()
      })
    },
    []
  )

  const generate = useCallback(async () => {
    if (stateRef.current.status === 'generating') {
      abortRef.current?.abort()
    }

    const current = stateRef.current
    if (!current.photoKey || !current.photoUrl) {
      const msg = 'Photo is required'
      setState((s) => ({ ...s, error: msg }))
      throw new Error(msg)
    }
    if (!current.prompt.trim()) {
      const msg = 'Prompt is required'
      setState((s) => ({ ...s, error: msg }))
      throw new Error(msg)
    }

    clearTimers()
    elapsedStartRef.current = Date.now()
    progressTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - elapsedStartRef.current) / 1000)
      const { label, progress } = computeStage(elapsed)
      setState((s) => ({
        ...s,
        elapsedSeconds: elapsed,
        stageLabel: label,
        generateProgress: progress,
      }))
    }, 1000)

    setState((s) => ({
      ...s,
      status: 'generating',
      generateProgress: 0,
      elapsedSeconds: 0,
      stageLabel: 'Step 1: Designing your tattoo',
      error: null,
      result: null,
      refunded: false,
    }))

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ai/generate-tattoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyPhotoKey: current.photoKey,
          bodyPhotoUrl: current.photoUrl,
          prompt: current.prompt.trim(),
        }),
        signal: abortRef.current.signal,
      })

      let trigger: TriggerResponse
      try {
        trigger = (await res.json()) as TriggerResponse
      } catch {
        throw new Error('Invalid response from server')
      }

      if (!res.ok || !trigger.projectId) {
        throw new Error(trigger.error || `Generation failed (HTTP ${res.status})`)
      }

      const data = await pollStatus(trigger.projectId)

      clearTimers()
      const allFailed = data.status === 'failed'
      const hasDesign = !!data.tattooDesignUrl
      setState((s) => ({
        ...s,
        status: allFailed ? 'error' : 'completed',
        generateProgress: 100,
        stageLabel: allFailed ? 'All parts failed' : 'Done!',
        result: hasDesign
          ? {
              projectId: trigger.projectId,
              tattooDesignUrl: data.tattooDesignUrl,
              images: data.images,
            }
          : null,
        refunded: allFailed,
        error: allFailed ? 'All 4 body parts failed' : null,
      }))
    } catch (e) {
      clearTimers()
      if (stateRef.current.status === 'idle') return
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      const msg = aborted
        ? 'Generation canceled'
        : e instanceof Error
          ? e.message
          : String(e)
      setState((s) => ({
        ...s,
        status: 'error',
        stageLabel: 'Failed',
        error: msg,
      }))
      throw new Error(msg)
    }
  }, [clearTimers, pollStatus])

  const reset = useCallback(() => {
    clearTimers()
    abortRef.current?.abort()
    setState(INITIAL_STATE)
  }, [clearTimers])

  const resetPrompt = useCallback(() => {
    clearTimers()
    setState((s) => ({
      ...INITIAL_STATE,
      photoKey: s.photoKey,
      photoUrl: s.photoUrl,
      status: s.photoKey ? 'ready' : 'idle',
    }))
  }, [clearTimers])

  const clearPhoto = useCallback(() => {
    setState((s) => ({
      ...s,
      photoKey: null,
      photoUrl: null,
      status: 'idle',
      uploadProgress: 0,
    }))
  }, [])

  return {
    ...state,
    setPrompt,
    uploadPhoto,
    generate,
    reset,
    resetPrompt,
    clearPhoto,
  }
}
