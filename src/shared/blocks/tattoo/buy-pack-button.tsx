'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

/**
 * Production checkout action injected into the shared pricing cards. It posts
 * to the existing checkout API (Waffo) and forwards anonymous users to
 * sign-in first, mirroring the previous pricing block behavior.
 */
export function BuyPackButton({
  productId,
  currency,
  title,
  locale,
}: {
  productId?: string;
  currency?: string;
  title?: string;
  locale: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      disabled={loading}
      className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50"
      onClick={async () => {
        setLoading(true);
        try {
          const response = await fetch('/api/payment/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: productId,
              currency: currency || 'USD',
              locale,
              payment_provider: 'waffo',
              metadata: {},
            }),
          });
          if (response.status === 401) {
            const base = locale === 'zh' ? '/zh' : '';
            router.push(`${base}/sign-in?callbackUrl=/pricing`);
            return;
          }
          const { code, message, data } = await response.json();
          if (!response.ok || code !== 0) throw new Error(message || 'checkout failed');
          if (!data?.checkoutUrl) throw new Error('checkout url not found');
          window.location.href = data.checkoutUrl;
        } catch (error) {
          setLoading(false);
          console.log('checkout failed: ', error);
        }
      }}
    >
      {loading ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          <span>Processing…</span>
        </>
      ) : (
        <span>{title}</span>
      )}
    </button>
  );
}
