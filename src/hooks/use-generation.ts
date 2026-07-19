'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GenerateImage,
  GenerateResponse,
  UploadUrlResponse,
} from '@/types'

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
  result: GenerateResponse | null
  /** 4 张全失败时为 true（后端已退款） */
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

/** 假进度推进时间表（基于 Day 3 实测耗时） */
const STAGE1_END_SEC = 110      // 0-110s: Step 1（纹身图案生成）
const STAGE2_END_SEC = 250      // 110-250s: Step 2（4 部位融合）
const PROGRESS_CAP = 95         // 不冲到 100%，避免假象

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
  const elapsedStartRef = useRef<number>(0)

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    // 卸载时清理
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

    // 客户端预检（双保险，组件层已检过）
    if (file.size > 10 * 1024 * 1024) {
      setState((s) => ({ ...s, status: 'ready', error: 'File too large (max 10MB)' }))
      throw new Error('File too large (max 10MB)')
    }

    // Step A: 拿预签名 URL
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

    // Step B: PUT 到 R2，用 XMLHttpRequest 拿 progress
    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = (e.loaded / e.total) * 100
            setState((s) => ({ ...s, uploadProgress: pct }))
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

  const generate = useCallback(async () => {
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

    // 启动进度计时器
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

    // AbortController 15 分钟超时兜底
    abortRef.current = new AbortController()
    const timeoutId = setTimeout(() => abortRef.current?.abort(), 15 * 60 * 1000)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyPhotoKey: current.photoKey,
          bodyPhotoUrl: current.photoUrl,
          prompt: current.prompt.trim(),
        }),
        signal: abortRef.current.signal,
      })

      const data: GenerateResponse = await res.json().catch(() => ({
        projectId: '',
        tattooDesignUrl: '',
        images: [] as GenerateImage[],
        error: 'Invalid server response',
      }))

      if (!res.ok) {
        throw new Error(data.error || `Generation failed (HTTP ${res.status})`)
      }

      // 4 张全失败的语义判定
      const allFailed =
        data.images.length > 0 && data.images.every((img) => img.status === 'failed')

      clearTimers()
      setState((s) => ({
        ...s,
        status: allFailed ? 'error' : 'completed',
        generateProgress: 100,
        stageLabel: allFailed ? 'All parts failed' : 'Done!',
        result: data,
        refunded: allFailed,
        error: allFailed ? data.error || 'All 4 body parts failed' : null,
      }))
    } catch (e) {
      clearTimers()
      const aborted = e instanceof DOMException && e.name === 'AbortError'
      const msg = aborted
        ? 'Generation timed out after 15 minutes. Please try again.'
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
    } finally {
      clearTimeout(timeoutId)
    }
  }, [clearTimers])

  const reset = useCallback(() => {
    clearTimers()
    abortRef.current?.abort()
    setState(INITIAL_STATE)
  }, [clearTimers])

  /** 清空照片但保留 prompt（用于 "Try another idea"） */
  const resetPhoto = useCallback(() => {
    clearTimers()
    setState((s) => ({
      ...INITIAL_STATE,
      prompt: s.prompt,
    }))
  }, [clearTimers])

  // stateRef 让 generate 能读到最新状态（避免 stale closure）
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  return {
    ...state,
    setPrompt,
    uploadPhoto,
    generate,
    reset,
    resetPhoto,
  }
}
