'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

/** Delete button for account library records; the server re-verifies ownership. */
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
  const t = useTranslations('common');
  const zh = useLocale() === 'zh';
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        className="text-muted-foreground hover:text-destructive focus-visible:outline-primary inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
        aria-busy={busy}
        onClick={async () => {
          if (!confirming) {
            setConfirming(true);
            return;
          }
          setBusy(true);
          setError('');
          try {
            const response = await fetch(
              `/api/studio?collection=${collection}&id=${encodeURIComponent(id)}`,
              { method: 'DELETE' }
            );
            if (!response.ok) {
              const data = await response.json().catch(() => ({}));
              throw new Error(data.error || t('deleteFailed'));
            }
            router.refresh();
          } catch (reason) {
            setError(reason instanceof Error ? reason.message : '');
            setConfirming(false);
          } finally {
            setBusy(false);
          }
        }}
        onBlur={() => setConfirming(false)}
      >
        {busy && (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
        )}
        {busy
          ? zh
            ? '正在删除…'
            : 'Deleting…'
          : confirming
            ? confirmLabel
            : label}
      </button>
      {error && (
        <span className="text-destructive ml-2 text-xs" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
