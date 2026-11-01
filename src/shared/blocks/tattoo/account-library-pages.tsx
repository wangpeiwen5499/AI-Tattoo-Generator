'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

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
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <span>
      <button
        type="button"
        disabled={busy}
        className="text-muted-foreground hover:text-destructive inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors disabled:opacity-50"
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
        {busy ? '…' : confirming ? confirmLabel : label}
      </button>
      {error && (
        <span className="text-destructive ml-2 text-xs" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
