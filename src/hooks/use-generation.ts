'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** POST /api/ai/generate-tattoo 响应 */
interface TriggerResponse {
  projectId: string;
  error?: string;
}

/** GET /api/ai/generate-tattoo/status 响应 */
interface StatusResponse {
  projectId: string;
  createdAt: string;
  status: string;
  tattooDesignUrl: string | null;
  images: Array<{ bodyPart: string; status: string; url: string | null }>;
  refunded: boolean;
  stage: string;
  completedParts: number;
  error?: string | null;
}

/** 前端使用的生成结果 */
export interface GenerateResult {
  projectId: string;
  tattooDesignUrl: string | null;
  images: Array<{ bodyPart: string; status: string; url: string | null }>;
}

export type GenStatus =
  'idle' | 'uploading' | 'ready' | 'generating' | 'completed' | 'error';

export type GenState = {
  status: GenStatus;
  uploadProgress: number;
  generateProgress: number;
  stageLabel: string;
  elapsedSeconds: number;
  photoKey: string | null;
  photoUrl: string | null;
  prompt: string;
  result: GenerateResult | null;
  refunded: boolean;
  error: string | null;
};

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
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 21 * 60 * 1000;
const ACTIVE_PROJECT_KEY = 'tattoo-active-project';

export function useGeneration() {
  const [state, setState] = useState<GenState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const elapsedStartRef = useRef<number>(0);
  const requestIdRef = useRef<string | null>(null);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      abortRef.current?.abort();
    };
  }, [clearTimers]);

  const setPrompt = useCallback((prompt: string) => {
    requestIdRef.current = null;
    setState((s) => ({ ...s, prompt }));
  }, []);

  const uploadPhoto = useCallback(async (file: File) => {
    requestIdRef.current = null;
    setState((s) => ({
      ...s,
      status: 'uploading',
      uploadProgress: 0,
      error: null,
      result: null,
      refunded: false,
    }));

    if (file.size > 10 * 1024 * 1024) {
      setState((s) => ({
        ...s,
        status: 'idle',
        error: 'File too large (max 10MB)',
      }));
      throw new Error('File too large (max 10MB)');
    }

    type UploadUrlResponse = {
      key: string;
      uploadUrl: string;
      publicUrl: string;
    };

    let uploadRes: UploadUrlResponse;
    try {
      const res = await fetch('/api/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentType: file.type,
          contentLength: file.size,
          ext: file.type.split('/')[1] || 'jpg',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body.error || `Upload URL request failed (HTTP ${res.status})`
        );
      }
      uploadRes = (await res.json()) as UploadUrlResponse;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, status: 'idle', error: msg }));
      throw e;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setState((s) => ({
              ...s,
              uploadProgress: (e.loaded / e.total) * 100,
            }));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload failed (HTTP ${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('R2 upload network error'));
        xhr.open('PUT', uploadRes.uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState((s) => ({ ...s, status: 'idle', error: msg }));
      throw e;
    }

    setState((s) => ({
      ...s,
      status: 'ready',
      uploadProgress: 100,
      photoKey: uploadRes.key,
      photoUrl: uploadRes.publicUrl,
    }));
  }, []);

  const pollStatus = useCallback(
    (projectId: string): Promise<StatusResponse> => {
      return new Promise((resolve, reject) => {
        const startedAt = Date.now();

        const tick = async () => {
          if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
            reject(
              new Error(
                'Still waiting for the result. Refresh this page to resume checking.'
              )
            );
            return;
          }

          let data: StatusResponse;
          try {
            const res = await fetch(
              `/api/ai/generate-tattoo/status?id=${projectId}`,
              {
                signal: abortRef.current?.signal,
                cache: 'no-store',
              }
            );
            if (res.status === 401 || res.status === 404) {
              sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
              reject(
                new Error(
                  'This generation is unavailable for your current session.'
                )
              );
              return;
            }
            if (!res.ok) throw new Error('Status temporarily unavailable');
            data = (await res.json()) as StatusResponse;
          } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') {
              reject(e);
              return;
            }
            pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
            return;
          }

          setState((s) => ({
            ...s,
            generateProgress:
              data.stage === 'design'
                ? 5
                : data.stage === 'fusion'
                  ? 35 + Math.min(data.completedParts, 4) * 15
                  : 95,
            stageLabel:
              data.stage === 'design'
                ? 'Designing your tattoo'
                : data.stage === 'fusion'
                  ? `Placing on body: ${data.completedParts}/4 complete`
                  : 'Saving results and checking credits',
          }));

          if (data.status === 'completed' || data.status === 'failed') {
            resolve(data);
            return;
          }
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        };

        tick();
      });
    },
    []
  );

  const applyResult = useCallback(
    (projectId: string, data: StatusResponse) => {
      clearTimers();
      setState((s) => ({
        ...s,
        status: data.status === 'failed' ? 'error' : 'completed',
        generateProgress: 100,
        stageLabel: data.status === 'failed' ? 'Generation failed' : 'Done!',
        result: data.tattooDesignUrl
          ? {
              projectId,
              tattooDesignUrl: data.tattooDesignUrl,
              images: data.images,
            }
          : null,
        refunded: data.refunded === true,
        error:
          data.status === 'failed'
            ? data.error || 'Unable to generate previews'
            : null,
      }));
      requestIdRef.current = null;
    },
    [clearTimers]
  );

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const restore = async () => {
      try {
        const savedId = sessionStorage.getItem(ACTIVE_PROJECT_KEY);
        // An active job from another tab takes priority over an older saved result.
        let res = await fetch('/api/ai/generate-tattoo/status', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (res.status === 204 && savedId) {
          res = await fetch(
            `/api/ai/generate-tattoo/status?id=${encodeURIComponent(savedId)}`,
            { signal: controller.signal, cache: 'no-store' }
          );
        }
        if (cancelled || stateRef.current.status !== 'idle') return;
        if (!res.ok || res.status === 204) {
          if (res.status === 401 || res.status === 404)
            sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
          return;
        }
        const data: StatusResponse = await res.json();
        if (cancelled || !data.projectId || stateRef.current.status !== 'idle')
          return;
        sessionStorage.setItem(ACTIVE_PROJECT_KEY, data.projectId);
        if (data.status !== 'processing') {
          applyResult(data.projectId, data);
          return;
        }
        abortRef.current = controller;
        elapsedStartRef.current = new Date(data.createdAt).getTime();
        setState((s) => ({
          ...s,
          status: 'generating',
          stageLabel: 'Resuming your generation',
        }));
        progressTimerRef.current = setInterval(
          () =>
            setState((s) => ({
              ...s,
              elapsedSeconds: Math.max(
                0,
                Math.floor((Date.now() - elapsedStartRef.current) / 1000)
              ),
            })),
          1000
        );
        const result = await pollStatus(data.projectId);
        if (!cancelled) applyResult(data.projectId, result);
      } catch (error) {
        if (
          !cancelled &&
          !(error instanceof DOMException && error.name === 'AbortError')
        ) {
          clearTimers();
          setState((s) => ({
            ...s,
            status: 'error',
            error:
              error instanceof Error
                ? error.message
                : 'Unable to resume generation',
          }));
        }
      }
    };
    void restore();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applyResult, clearTimers, pollStatus]);

  const generate = useCallback(async () => {
    if (stateRef.current.status === 'generating') {
      abortRef.current?.abort();
    }

    const current = stateRef.current;
    if (!current.photoKey || !current.photoUrl) {
      const msg = 'Photo is required';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }
    if (!current.prompt.trim()) {
      const msg = 'Prompt is required';
      setState((s) => ({ ...s, error: msg }));
      throw new Error(msg);
    }

    clearTimers();
    elapsedStartRef.current = Date.now();
    progressTimerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - elapsedStartRef.current) / 1000);
      setState((s) => ({
        ...s,
        elapsedSeconds: elapsed,
      }));
    }, 1000);

    setState((s) => ({
      ...s,
      status: 'generating',
      generateProgress: 0,
      elapsedSeconds: 0,
      stageLabel: 'Step 1: Designing your tattoo',
      error: null,
      result: null,
      refunded: false,
    }));

    abortRef.current = new AbortController();

    try {
      requestIdRef.current ??= crypto.randomUUID();
      const res = await fetch('/api/ai/generate-tattoo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bodyPhotoKey: current.photoKey,
          bodyPhotoUrl: current.photoUrl,
          prompt: current.prompt.trim(),
          requestId: requestIdRef.current,
        }),
        signal: abortRef.current.signal,
      });

      let trigger: TriggerResponse;
      try {
        trigger = (await res.json()) as TriggerResponse;
      } catch {
        throw new Error('Invalid response from server');
      }

      if (!res.ok || !trigger.projectId) {
        throw new Error(
          trigger.error || `Generation failed (HTTP ${res.status})`
        );
      }

      sessionStorage.setItem(ACTIVE_PROJECT_KEY, trigger.projectId);
      const data = await pollStatus(trigger.projectId);
      applyResult(trigger.projectId, data);
    } catch (e) {
      clearTimers();
      if (stateRef.current.status === 'idle') return;
      const aborted = e instanceof DOMException && e.name === 'AbortError';
      const msg = aborted
        ? 'Generation canceled'
        : e instanceof Error
          ? e.message
          : String(e);
      setState((s) => ({
        ...s,
        status: 'error',
        stageLabel: 'Failed',
        error: msg,
      }));
      throw new Error(msg);
    }
  }, [applyResult, clearTimers, pollStatus]);

  const reset = useCallback(() => {
    sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
    requestIdRef.current = null;
    clearTimers();
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, [clearTimers]);

  const resetPrompt = useCallback(() => {
    sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
    requestIdRef.current = null;
    clearTimers();
    setState((s) => ({
      ...INITIAL_STATE,
      photoKey: s.photoKey,
      photoUrl: s.photoUrl,
      status: s.photoKey ? 'ready' : 'idle',
    }));
  }, [clearTimers]);

  const clearPhoto = useCallback(() => {
    setState((s) => ({
      ...s,
      photoKey: null,
      photoUrl: null,
      status: 'idle',
      uploadProgress: 0,
    }));
  }, []);

  return {
    ...state,
    setPrompt,
    uploadPhoto,
    generate,
    reset,
    resetPrompt,
    clearPhoto,
  };
}
