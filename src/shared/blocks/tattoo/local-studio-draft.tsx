'use client';

import { useEffect, useRef, useState } from 'react';
import {
  readLoginDraft,
  removeLoginDraft,
  saveLoginDraft,
  type StudioLoginDraft,
} from '@/lib/studio-login-draft';

const storageKey = 'tattoovis-local-studio-draft';
const retentionMs = 7 * 24 * 60 * 60 * 1000;
const buttonClass =
  'min-h-11 rounded-full border px-4 text-sm disabled:opacity-50';

export function LocalStudioDraft({
  locale,
  disabled,
  hasContent,
  capture,
  restore,
  snapshotKey,
}: {
  locale: string;
  disabled: boolean;
  hasContent: boolean;
  capture: () => Promise<Omit<StudioLoginDraft, 'expires'>>;
  restore: (draft: StudioLoginDraft) => Promise<void>;
  snapshotKey: string;
}) {
  const zh = locale === 'zh';
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const errorMessage = zh
    ? '本地草稿操作失败。当前编辑内容仍在此页面，请保留页面并稍后重试。浏览器可能禁用了存储或空间不足。'
    : 'Local draft action failed. Your current work remains on this page; keep it open and try again. Browser storage may be disabled or full.';

  useEffect(() => {
    mounted.current = true;
    let revision = 0;
    async function load() {
      const currentRevision = ++revision;
      try {
        const current = localStorage.getItem(storageKey);
        const draft = current ? await readLoginDraft(current) : null;
        if (!mounted.current || currentRevision !== revision) return;
        if (current !== localStorage.getItem(storageKey)) return void load();
        if (current && !draft) localStorage.removeItem(storageKey);
        setToken(draft ? current : null);
        setSavedKey(null);
      } catch {
        if (mounted.current) setMessage(errorMessage);
      } finally {
        if (mounted.current) setReady(true);
      }
    }
    void load();
    const listener = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) void load();
    };
    window.addEventListener('storage', listener);
    return () => {
      mounted.current = false;
      revision++;
      window.removeEventListener('storage', listener);
    };
  }, [errorMessage]);

  async function save() {
    setBusy(true);
    setMessage('');
    let created: string | null = null;
    try {
      const previous = localStorage.getItem(storageKey);
      const capturedKey = snapshotKey;
      created = await saveLoginDraft(await capture(), retentionMs);
      if (localStorage.getItem(storageKey) !== previous) {
        await removeLoginDraft(created);
        created = null;
        setToken(localStorage.getItem(storageKey));
        throw new Error('Draft changed in another tab');
      }
      localStorage.setItem(storageKey, created);
      setToken(created);
      setSavedKey(capturedKey);
      created = null;
      if (previous) await removeLoginDraft(previous);
      setMessage(
        zh ? '本地草稿已保存，有效期 7 天。' : 'Local draft saved for 7 days.'
      );
    } catch {
      if (created) await removeLoginDraft(created).catch(() => {});
      setMessage(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function restoreSaved() {
    if (!token) return;
    setBusy(true);
    setMessage('');
    try {
      const draft = await readLoginDraft(token);
      if (!draft) {
        if (localStorage.getItem(storageKey) === token)
          localStorage.removeItem(storageKey);
        setToken(null);
        setSavedKey(null);
        setMessage(
          zh
            ? '本地草稿已过期或不存在。'
            : 'Local draft has expired or is unavailable.'
        );
        return;
      }
      await restore(draft);
      setSavedKey(null);
      setMessage(
        zh
          ? '已恢复本地草稿。后续修改需手动保存。'
          : 'Local draft restored. Save later changes manually.'
      );
    } catch {
      setMessage(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    if (!token) return;
    setBusy(true);
    try {
      await removeLoginDraft(token);
      if (localStorage.getItem(storageKey) === token)
        localStorage.removeItem(storageKey);
      setToken(null);
      setSavedKey(null);
      setMessage(zh ? '已删除本地草稿。' : 'Local draft deleted.');
    } catch {
      setMessage(errorMessage);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label={zh ? '可选本地草稿' : 'Optional local draft'}
      className="space-y-3 rounded-xl border p-4"
    >
      <h3 className="font-medium">
        {zh ? '可选本地草稿' : 'Optional local draft'}
      </h3>
      <p className="text-muted-foreground text-sm">
        {zh
          ? '仅保存在当前浏览器，保留 7 天，不会上传到账户，也不会自动保存。此浏览器只保留一个草稿，保存会替换原草稿；恢复会替换当前编辑内容。'
          : 'Stored only in this browser for 7 days. It is not uploaded to your account and does not auto-save. This browser keeps one draft: saving replaces it; restoring replaces your current work.'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || busy || !ready || !hasContent}
          onClick={save}
        >
          {zh
            ? token
              ? '替换本地草稿'
              : '保存本地草稿'
            : token
              ? 'Replace local draft'
              : 'Save local draft'}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || busy || !token}
          onClick={restoreSaved}
        >
          {zh ? '恢复草稿' : 'Restore draft'}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || busy || !token}
          onClick={discard}
        >
          {zh ? '删除草稿' : 'Delete draft'}
        </button>
      </div>
      <p role="status" className="text-sm">
        {busy ? (zh ? '处理中…' : 'Working…') : message}
      </p>
      {savedKey !== null && savedKey !== snapshotKey && (
        <p className="text-muted-foreground text-sm">
          {zh
            ? '当前修改尚未保存到本地草稿。'
            : 'Current changes have not been saved to the local draft.'}
        </p>
      )}
    </section>
  );
}
