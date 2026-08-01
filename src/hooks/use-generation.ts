'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  GenerateResponse,
  GenerateTriggerResponse,
  GenerationStatusResponse,
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

/** 轮询参数 */
const POLL_INTERVAL_MS = 3000           // 每 3s 轮询一次
const POLL_TIMEOUT_MS = 5.5 * 60 * 1000 // 略超 maxDuration(5min)，兜底防永久轮询

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

  // stateRef 让 generate 能读到最新状态（避免 stale closure）
  // 必须在任何使用 stateRef.current 的 callback 之前声明
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
      setState((s) => ({ ...s, status: 'idle', error: 'File too large (max 10MB)' }))
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

  /**
   * 轮询 /api/generate/status 直到 completed/failed 或超时。
   * - resolve 返回最终状态对象（completed 或 failed 都 resolve，由 generate 判定）
   * - reject 表示真错误：超时 / reset 主动取消（AbortError）
   * 单次轮询的网络错误不致命，排下一次重试。
   * 用 setTimeout 链（而非 setInterval）避免上一次 fetch 慢导致请求堆积。
   */
  const pollStatus = useCallback(
    (projectId: string): Promise<GenerationStatusResponse> => {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now()

        const tick = async () => {
          // 超时兜底
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            reject(new Error('Generation timed out. Check /history later.'))
            return
          }

          let data: GenerationStatusResponse
          try {
            const res = await fetch(`/api/generate/status?id=${projectId}`, {
              signal: abortRef.current?.signal,
            })
            data = (await res.json()) as GenerationStatusResponse
          } catch (e) {
            // reset()/卸载主动 abort → 终止轮询
            if (e instanceof DOMException && e.name === 'AbortError') {
              reject(e)
              return
            }
            // 单次网络错误 → 排下一次重试（不致命）
            pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
            return
          }

          if (data.status === 'completed' || data.status === 'failed') {
            resolve(data)
            return
          }
          // processing → 继续轮询
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS)
        }

        // 首次立即跑一次（不等 3s），让"刚触发"也能很快拿到 processing
        tick()
      })
    },
    []
  )

  const generate = useCallback(async () => {
    // 防止双击并发：如果已在 generating，先 abort 上一个
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

    abortRef.current = new AbortController()

    try {
      // 1. 触发生成，立即拿 projectId（后端 after() 后台跑 AI）
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

      let trigger: GenerateTriggerResponse
      try {
        trigger = (await res.json()) as GenerateTriggerResponse
      } catch {
        throw new Error('Invalid response from server')
      }

      if (!res.ok || !trigger.projectId) {
        const errBody = trigger as unknown as { error?: string }
        throw new Error(errBody.error || `Generation failed (HTTP ${res.status})`)
      }

      // 2. 轮询 status 直到 completed/failed
      const data = await pollStatus(trigger.projectId)

      clearTimers()
      const allFailed = data.status === 'failed'
      // Step1 失败时后端 project=failed 且 generations 为空 → tattooDesignUrl=null
      // 此时 result 保持 null，走纯 error 路径（与原同步行为一致，避免渲染 broken img）
      const hasDesign = !!data.tattooDesignUrl
      setState((s) => ({
        ...s,
        status: allFailed ? 'error' : 'completed',
        generateProgress: 100,
        stageLabel: allFailed ? 'All parts failed' : 'Done!',
        result: hasDesign
          ? {
              projectId: trigger.projectId,
              tattooDesignUrl: data.tattooDesignUrl as string,
              images: data.images,
              error: data.error ?? undefined,
            }
          : null,
        refunded: allFailed,
        error: allFailed ? data.error || 'All 4 body parts failed' : null,
      }))
    } catch (e) {
      clearTimers()
      // 如果状态已被外部 reset() 改为 idle，说明用户主动取消了，
      // 此时不应再覆盖状态；同时静默吞掉 AbortError，不向调用方抛出。
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

  /** 清空 prompt 但保留照片（用于 "Try another idea"） */
  const resetPrompt = useCallback(() => {
    clearTimers()
    setState((s) => ({
      ...INITIAL_STATE,
      photoKey: s.photoKey,
      photoUrl: s.photoUrl,
      // 照片还在 → 保持可生成态（ready），否则回 idle
      status: s.photoKey ? 'ready' : 'idle',
    }))
  }, [clearTimers])

  /** 清空照片（用于 ImageUploader 的 X 按钮） */
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
