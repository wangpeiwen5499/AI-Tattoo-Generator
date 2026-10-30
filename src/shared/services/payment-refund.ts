import { and, eq } from 'drizzle-orm';

import { db } from '@/core/db';
import { order, user } from '@/config/db/schema';
import type { PaymentSession } from '@/extensions/payment/types';
import {
  parseRefundLedger,
  resolveRefundLedger,
} from '@/shared/lib/payment-refund';
import { revokeOrderGrant } from '@/shared/models/payment-refund';

export async function handleWaffoRefund(session: PaymentSession) {
  const event = session.refundInfo;
  if (session.provider !== 'waffo' || !event)
    throw new Error('Missing verified Waffo refund');
  const orderNo = session.metadata?.order_no;
  if (orderNo && typeof orderNo !== 'string')
    throw new Error('Invalid refund order reference');
  const matches = await db()
    .select()
    .from(order)
    .where(
      and(
        eq(order.paymentProvider, 'waffo'),
        orderNo
          ? eq(order.orderNo, orderNo)
          : eq(order.transactionId, event.transactionId)
      )
    )
    .limit(2);
  if (matches.length !== 1)
    throw new Error('Refund order missing or ambiguous');
  const owner = matches[0];
  return db().transaction(async (tx) => {
    const [lockedUser] = await tx
      .select({ id: user.id })
      .from(user)
      .where(eq(user.id, owner.userId))
      .for('no key update');
    if (!lockedUser) throw new Error('Refund user not found');
    const [locked] = await tx
      .select()
      .from(order)
      .where(eq(order.id, owner.id))
      .for('update');
    if (
      !locked ||
      locked.paymentProvider !== 'waffo' ||
      locked.paymentType !== 'one-time'
    )
      throw new Error('Unsupported refund order');
    if (locked.transactionId && locked.transactionId !== event.transactionId)
      throw new Error('Refund transaction does not match order');
    if (
      event.currency !==
      (locked.paymentCurrency || locked.currency).toUpperCase()
    )
      throw new Error('Refund currency does not match order');
    const payment = locked.paymentResult
      ? JSON.parse(locked.paymentResult)
      : null;
    if (
      payment?.paymentId &&
      event.paymentId &&
      payment.paymentId !== event.paymentId
    )
      throw new Error('Refund charge does not match order');
    const ledger = parseRefundLedger(locked.refundInfo);
    if (
      ledger.events.some((e) => e.id === event.id && e.status === event.status)
    )
      return {
        duplicate: true,
        fullyRefunded: ledger.fullyRefunded,
        manualReview: ledger.manualReview,
      };
    const received = {
      ...event,
      receivedAt: new Date().toISOString(),
      recoveredCredits: 0,
    };
    ledger.events.push(received);
    const next = resolveRefundLedger(
      ledger,
      locked.paymentAmount,
      locked.transactionId
    );
    if (next.fullyRefunded)
      received.recoveredCredits = await revokeOrderGrant(
        tx,
        locked.userId,
        locked.orderNo,
        event.id
      );
    await tx
      .update(order)
      .set({
        refundInfo: JSON.stringify(next),
        status: next.fullyRefunded ? 'refunded' : locked.status,
        transactionId: locked.transactionId || event.transactionId,
      })
      .where(eq(order.id, locked.id));
    return {
      duplicate: false,
      fullyRefunded: next.fullyRefunded,
      manualReview: next.manualReview,
    };
  });
}
