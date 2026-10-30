import type { PaymentRefund } from '@/extensions/payment/types';

export interface RefundEvent extends PaymentRefund {
  receivedAt: string;
  recoveredCredits?: number;
}
export interface RefundLedger {
  version: 1;
  events: RefundEvent[];
  fullyRefunded: boolean;
  manualReview: boolean;
}
export function parseRefundLedger(raw?: string | null): RefundLedger {
  if (!raw)
    return {
      version: 1,
      events: [],
      fullyRefunded: false,
      manualReview: false,
    };
  const value = JSON.parse(raw);
  if (value.version !== 1 || !Array.isArray(value.events))
    throw new Error('Invalid refund ledger');
  return value;
}
export function resolveRefundLedger(
  ledger: RefundLedger,
  paidAmount?: number | null,
  transactionId?: string | null
): RefundLedger {
  let full = false;
  let manual = false;
  for (const event of ledger.events) {
    if (transactionId && event.transactionId !== transactionId)
      throw new Error('Refund transaction does not match payment');
    if (event.status !== 'succeeded') continue;
    if (
      paidAmount &&
      event.originalChargedAmount &&
      paidAmount !== event.originalChargedAmount
    )
      throw new Error('Refund original charge does not match payment');
    const original = paidAmount || event.originalChargedAmount;
    if (original && event.amount && event.amount > original)
      throw new Error('Refund exceeds original charge');
    if (original && event.amount === original) full = true;
    else manual = true; // Partial or missing amount: explicit human handling, no proportional clawback.
  }
  return { ...ledger, fullyRefunded: full, manualReview: manual };
}
