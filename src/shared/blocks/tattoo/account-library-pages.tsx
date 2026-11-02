'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/shared/components/ui/dialog';

const buttonClass =
  'inline-flex min-h-11 items-center rounded-full border px-4 text-sm disabled:opacity-50';
const subscribeToHydration = () => () => {};
export function LocalDate({ value }: { value: string }) {
  const locale = useLocale();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false
  );
  const local = hydrated
    ? new Date(value).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US')
    : undefined;
  return (
    <time dateTime={value}>
      {local ?? `${value.slice(0, 16).replace('T', ' ')} UTC`}
    </time>
  );
}
export function DeleteRecordButton({
  collection,
  id,
  label,
  confirmLabel,
}: {
  collection: 'designs' | 'history';
  id: string;
  label: string;
  confirmLabel: string;
}) {
  const zh = useLocale() === 'zh',
    router = useRouter();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function remove() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/studio?collection=${collection}&id=${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      if (!response.ok)
        throw new Error(
          zh ? '删除失败，请重试。' : 'Could not delete. Please try again.'
        );
      setOpen(false);
      router.refresh();
    } catch {
      setError(
        zh ? '删除失败，请重试。' : 'Could not delete. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className={buttonClass}
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        {label}
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {zh ? '删除这条记录？' : 'Delete this record?'}
          </DialogTitle>
          <DialogDescription>
            {zh
              ? '删除后将从账户图库中移除，无法撤销。'
              : 'This removes the record from your account library and cannot be undone.'}
          </DialogDescription>
          {error && <p role="alert">{error}</p>}
          <div className="flex gap-3">
            <button
              className={buttonClass}
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              {zh ? '取消' : 'Cancel'}
            </button>
            <button className={buttonClass} disabled={busy} onClick={remove}>
              {busy ? (zh ? '正在删除…' : 'Deleting…') : confirmLabel}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function RenameRecordButton({
  collection,
  id,
  name,
}: {
  collection: 'designs' | 'history';
  id: string;
  name: string;
}) {
  const zh = useLocale() === 'zh',
    router = useRouter();
  const [open, setOpen] = useState(false),
    [value, setValue] = useState(name),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button
        className={buttonClass}
        onClick={() => {
          setValue(name);
          setError('');
          setOpen(true);
        }}
      >
        {zh ? '重命名' : 'Rename'}
      </button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent>
          <DialogTitle>{zh ? '重命名记录' : 'Rename record'}</DialogTitle>
          <DialogDescription>
            {zh
              ? '为记录设置一个便于查找的名称。'
              : 'Choose a name that makes this record easy to find.'}
          </DialogDescription>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError('');
              try {
                const response = await fetch('/api/studio', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ collection, id, name: value.trim() }),
                });
                if (!response.ok)
                  throw new Error(
                    zh
                      ? '保存失败，请重试。'
                      : 'Could not save. Please try again.'
                  );
                setOpen(false);
                router.refresh();
              } catch {
                setError(
                  zh
                    ? '保存失败，请重试。'
                    : 'Could not save. Please try again.'
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block">
              {zh ? '名称' : 'Name'}
              <input
                className="mt-2 w-full rounded border p-3"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                required
                maxLength={100}
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <div className="mt-4 flex gap-3">
              <button
                type="button"
                className={buttonClass}
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                {zh ? '取消' : 'Cancel'}
              </button>
              <button className={buttonClass} disabled={busy || !value.trim()}>
                {busy ? (zh ? '保存中…' : 'Saving…') : zh ? '保存' : 'Save'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
