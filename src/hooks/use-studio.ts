'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StudioAccessError,
  studioClient,
  type StudioCapabilities,
  type StudioRecord,
  type StudioTask,
} from '@/lib/studio-client';

export function useStudio() {
  const [capabilities, setCapabilities] = useState<StudioCapabilities | null>(
    null
  );
  const [task, setTask] = useState<StudioTask | null>(null);
  const [phase, setPhase] = useState('');
  const [error, setError] = useState('');
  const [gate, setGate] = useState<number | null>(null);
  const [result, setResult] = useState<{
    kind: 'design' | 'render';
    record: StudioRecord;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<StudioTask | null>(null);
  const alive = useRef(true);
  const lock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const caps = await studioClient.capabilities(signal);
    if (alive.current) {
      setCapabilities(caps);
      setPending(caps.pending[0] || null);
      if (caps.signedIn)
        window.dispatchEvent(new Event('studio-credits-changed'));
    }
    return caps;
  }, []);
  useEffect(() => {
    alive.current = true;
    const abort = new AbortController();
    refresh(abort.signal).catch(() => {
      if (!abort.signal.aborted)
        setError('Could not connect to your account. Reload to retry.');
    });
    return () => {
      alive.current = false;
      abort.abort();
      controller.current?.abort();
    };
  }, [refresh]);
  const access = useCallback(
    (cost = 0) => {
      const status = !capabilities?.signedIn
        ? 401
        : !capabilities.verified
          ? 403
          : capabilities.credits < cost
            ? 402
            : null;
      setGate(status);
      return !status;
    },
    [capabilities]
  );
  const follow = useCallback(
    async (job: StudioTask, signal: AbortSignal) => {
      setTask(job);
      setPending(job);
      for (let attempt = 0; attempt < 720 && !signal.aborted; attempt++) {
        const status = await studioClient.status(job.task, signal);
        if (!alive.current) return;
        setPhase(status.state);
        if (status.state === 'review_required' || status.state === 'failed') {
          await refresh(signal);
          throw new Error(status.error || 'This task needs support review.');
        }
        if (status.state === 'success') {
          setPhase('loading');
          const { records } = await studioClient.collection(
            job.kind === 'design' ? 'designs' : 'history',
            signal
          );
          const record = records.find(
            (r) => r.operationId === status.operationId
          );
          if (!record)
            throw new Error(
              'Your result is saved. Open your library or retry to load it.'
            );
          if (alive.current) {
            setResult({ kind: job.kind, record });
            setTask(null);
            setPending(null);
          }
          await refresh(signal);
          return;
        }
        await new Promise<void>((resolve) => {
          const timer = setTimeout(done, 5000);
          function done() {
            clearTimeout(timer);
            signal.removeEventListener('abort', done);
            resolve();
          }
          signal.addEventListener('abort', done, { once: true });
        });
      }
    },
    [refresh]
  );
  const execute = useCallback(
    async (action: (signal: AbortSignal) => Promise<void>) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError('');
      setGate(null);
      const abort = new AbortController();
      controller.current = abort;
      try {
        await action(abort.signal);
      } catch (reason) {
        if (!abort.signal.aborted && alive.current) {
          setError(reason instanceof Error ? reason.message : 'Please retry.');
          if (
            reason instanceof StudioAccessError &&
            [401, 402, 403].includes(reason.status)
          )
            setGate(reason.status);
          await refresh(abort.signal).catch(() => {});
        }
      } finally {
        lock.current = false;
        if (alive.current) {
          setBusy(false);
          setPhase('');
        }
      }
    },
    [refresh]
  );
  const generate = useCallback(
    (prompt: string) => {
      if (!access(1)) return;
      void execute(async (signal) => {
        const operationId = crypto.randomUUID();
        setPhase('submitting');
        const { task } = await studioClient.start(
          'design',
          { operationId, prompt },
          signal
        );
        await refresh(signal).catch(() => {});
        await follow({ task, operationId, kind: 'design', prompt }, signal);
      });
    },
    [access, execute, follow, refresh]
  );
  const render = useCallback(
    (
      prepare: (signal: AbortSignal) => Promise<object>,
      resolution: string,
      cost: number
    ) => {
      if (!access(cost)) return;
      void execute(async (signal) => {
        setPhase('uploading');
        const input = await prepare(signal);
        const operationId = crypto.randomUUID();
        setPhase('submitting');
        const { task } = await studioClient.start(
          'render',
          { ...input, resolution, operationId },
          signal
        );
        await refresh(signal).catch(() => {});
        await follow({ task, operationId, kind: 'render', resolution }, signal);
      });
    },
    [access, execute, follow, refresh]
  );
  const resume = useCallback(() => {
    if (pending) void execute((signal) => follow(pending, signal));
  }, [pending, execute, follow]);
  return {
    capabilities,
    busy,
    error,
    gate,
    task,
    phase,
    result,
    pending,
    access,
    generate,
    render,
    resume,
    refresh,
  };
}
