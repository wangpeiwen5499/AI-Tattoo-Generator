import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { POST } from '@/app/api/payment/notify/[provider]/route';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { credit, order, user } from '@/config/db/schema';
import {
  consumeCredits,
  getRemainingCredits,
  refundConsumedCredits,
} from '@/shared/models/credit';

import { createTestDatabase } from './database';

const state = vi.hoisted(() => ({ database: null as any }));
vi.mock('@/core/db', () => ({ db: () => state.database }));
vi.mock('@/shared/models/user', () => ({
  appendUserToResult: (x: unknown) => x,
}));
vi.mock('@/shared/models/config', () => ({
  getAllConfigs: () => ({
    waffo_enabled: 'true',
    default_payment_provider: 'waffo',
    waffo_merchant_id: 'test',
    waffo_private_key: 'test',
  }),
}));
let close: () => Promise<void>;
const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
beforeAll(async () => {
  const test = await createTestDatabase();
  state.database = test.database;
  close = () => test.client.close();
  vi.stubEnv(
    'WAFFO_WEBHOOK_PROD_PUBLIC_KEY',
    key.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  );
  await state.database.insert(user).values({
    id: 'buyer',
    email: 'buyer@example.com',
    name: 'Buyer',
    emailVerified: true,
  });
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await close();
});
beforeEach(async () => {
  await state.database.delete(credit);
  await state.database.delete(order);
  await state.database.insert(credit).values({
    id: randomUUID(),
    userId: 'buyer',
    transactionNo: randomUUID(),
    transactionType: 'grant',
    transactionScene: 'gift',
    credits: 3,
    remainingCredits: 3,
    status: 'active',
  });
  await consumeCredits({ userId: 'buyer', credits: 3 });
  for (const no of ['paid-checkout', 'abandoned-checkout'])
    await state.database.insert(order).values({
      id: randomUUID(),
      orderNo: no,
      userId: 'buyer',
      userEmail: 'buyer@example.com',
      status: 'created',
      amount: 1499,
      currency: 'USD',
      creditsAmount: 20,
      paymentType: 'one-time',
      paymentProvider: 'waffo',
      checkoutInfo: '{}',
    });
});
function notification(
  ageMinutes = 0,
  tampered = false,
  event: { type?: string; id?: string; data?: Record<string, unknown> } = {}
) {
  const payload = JSON.stringify({
    id: event.id || 'event-1',
    eventId: event.id || 'event-1',
    eventType: event.type || 'order.completed',
    mode: 'prod',
    data: {
      orderId: 'waffo-paid-order',
      buyerEmail: 'buyer@example.com',
      amount: '14.99',
      subtotal: '14.99',
      total: '14.99',
      currency: 'USD',
      orderMetadata: { order_no: 'paid-checkout', user_id: 'buyer' },
      ...event.data,
    },
  });
  const t = String(Date.now() - ageMinutes * 60000);
  const signer = createSign('RSA-SHA256');
  signer.update(`${t}.${payload}`);
  const signature = signer.sign(key.privateKey, 'base64');
  return new Request('https://tattoovis.ink/api/payment/notify/waffo', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-waffo-signature': `t=${t},v1=${signature}`,
    },
    body: tampered ? payload.replace('14.99', '0.01') : payload,
  });
}
const notify = (age = 0, tampered = false) =>
  POST(notification(age, tampered), {
    params: Promise.resolve({ provider: 'waffo' }),
  });
it('fulfills a valid 31-minute retry after the signup gift was exhausted, only once and only for its matching checkout', async () => {
  expect(await getRemainingCredits('buyer')).toBe(0);
  const request = notification(31);
  const deliver = () =>
    POST(request.clone(), { params: Promise.resolve({ provider: 'waffo' }) });
  const simultaneous = await Promise.all([deliver(), deliver()]);
  expect(simultaneous.map((response) => response.status)).toEqual([200, 200]);
  expect(await getRemainingCredits('buyer')).toBe(20);
  expect((await deliver()).status).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(20);
  const rows = await state.database.select().from(order);
  expect(rows.find((r: any) => r.orderNo === 'paid-checkout').status).toBe(
    'paid'
  );
  expect(rows.find((r: any) => r.orderNo === 'abandoned-checkout').status).toBe(
    'created'
  );
});
it('rejects changed signed payloads without crediting the buyer', async () => {
  expect((await notify(0, true)).status).toBe(500);
  expect(await getRemainingCredits('buyer')).toBe(0);
});
it('continues to reject signatures outside the documented retry window', async () => {
  expect((await notify(46)).status).toBe(500);
  expect(await getRemainingCredits('buyer')).toBe(0);
});

const refundRequest = (
  id = 'refund-1',
  data: Record<string, unknown> = {},
  type = 'refund.succeeded'
) =>
  notification(0, false, {
    id,
    type,
    data: {
      amount: '14.99',
      refundedAmount: '14.99',
      originalChargedAmount: '14.99',
      refundStatus: type === 'refund.succeeded' ? 'succeeded' : 'failed',
      ...data,
    },
  });
const deliverRefund = (request = refundRequest()) =>
  POST(request, { params: Promise.resolve({ provider: 'waffo' }) });
it('revokes only the fully refunded order balance, retains courtesy credits, and does not regrant on late payment replay', async () => {
  await notify();
  await state.database.insert(credit).values({
    id: 'courtesy',
    userId: 'buyer',
    transactionNo: randomUUID(),
    transactionType: 'grant',
    transactionScene: 'gift',
    credits: 10,
    remainingCredits: 10,
    status: 'active',
  });
  expect(await getRemainingCredits('buyer')).toBe(30);
  const request = refundRequest();
  const responses = await Promise.all([
    deliverRefund(request.clone()),
    deliverRefund(request.clone()),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(await getRemainingCredits('buyer')).toBe(10);
  await notify();
  expect(await getRemainingCredits('buyer')).toBe(10);
  const rows = await state.database.select().from(order);
  const paid = rows.find((r: any) => r.orderNo === 'paid-checkout');
  expect(paid.status).toBe('refunded');
  expect(paid.paymentResult).toContain('waffo-paid-order');
  expect(JSON.parse(paid.refundInfo).events).toHaveLength(1);
});
it('handles full refund before payment delivery without ever making the order credits spendable', async () => {
  expect((await deliverRefund()).status).toBe(200);
  expect((await notify()).status).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(0);
  expect(
    (await state.database.select().from(order)).find(
      (r: any) => r.orderNo === 'paid-checkout'
    ).status
  ).toBe('refunded');
});
it('records partial refunds for manual review without automatically deducting credits', async () => {
  await notify();
  expect(
    (
      await deliverRefund(
        refundRequest('partial', { amount: '5.00', refundedAmount: '5.00' })
      )
    ).status
  ).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(20);
  const row = (await state.database.select().from(order)).find(
    (r: any) => r.orderNo === 'paid-checkout'
  );
  expect(JSON.parse(row.refundInfo).manualReview).toBe(true);
  expect(row.status).toBe('paid');
});
it('records failed refunds without reversing credits', async () => {
  await notify();
  expect(
    (await deliverRefund(refundRequest('failed', {}, 'refund.failed'))).status
  ).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(20);
});
it('does not restore refunded purchase credits when a generation later fails', async () => {
  await notify();
  const debit = await consumeCredits({ userId: 'buyer', credits: 1 });
  expect((await deliverRefund()).status).toBe(200);
  await refundConsumedCredits({ userId: 'buyer', creditId: debit.id });
  expect(await getRemainingCredits('buyer')).toBe(0);
  const grants = (await state.database.select().from(credit)).filter(
    (r: any) => r.orderNo === 'paid-checkout' && r.transactionType === 'grant'
  );
  expect(grants[0].remainingCredits).toBe(0);
});
it('rejects a refund pointing at a different provider transaction or currency', async () => {
  await notify();
  expect(
    (
      await deliverRefund(
        refundRequest('wrong', { orderId: 'different-order' })
      )
    ).status
  ).toBe(500);
  expect(
    (await deliverRefund(refundRequest('wrong-currency', { currency: 'EUR' })))
      .status
  ).toBe(500);
  expect(await getRemainingCredits('buyer')).toBe(20);
});

it('supports missing metadata via an exact transaction lookup, never email matching', async () => {
  await notify();
  expect(
    (
      await deliverRefund(
        refundRequest('no-meta', { orderMetadata: undefined })
      )
    ).status
  ).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(0);
});
it('leaves multiple partial refunds for manual handling even when their sum is the full amount', async () => {
  await notify();
  await deliverRefund(
    refundRequest('part-1', { refundedAmount: '5.00', amount: '5.00' })
  );
  await deliverRefund(
    refundRequest('part-2', { refundedAmount: '9.99', amount: '9.99' })
  );
  expect(await getRemainingCredits('buyer')).toBe(20);
});
it('allows a failed refund to later succeed with the same refund identity', async () => {
  await notify();
  await deliverRefund(refundRequest('same', {}, 'refund.failed'));
  expect(await getRemainingCredits('buyer')).toBe(20);
  await deliverRefund(refundRequest('same'));
  expect(await getRemainingCredits('buyer')).toBe(0);
});
it('reconciles a refund with no original amount when payment confirmation arrives later', async () => {
  expect(
    (
      await deliverRefund(
        refundRequest('pending', { originalChargedAmount: undefined })
      )
    ).status
  ).toBe(200);
  expect((await notify()).status).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(0);
});
it('only revokes the unused balance when some purchased credits have been spent', async () => {
  await notify();
  await consumeCredits({ userId: 'buyer', credits: 5 });
  expect(await getRemainingCredits('buyer')).toBe(15);
  await deliverRefund();
  expect(await getRemainingCredits('buyer')).toBe(0);
  const rows = await state.database.select().from(credit);
  expect(rows.find((r: any) => r.transactionType === 'revoke').credits).toBe(
    -15
  );
});

it('retains another paid order when refunding the first order', async () => {
  await notify();
  const other = notification(0, false, {
    id: 'second-payment',
    data: {
      orderId: 'waffo-second-order',
      orderMetadata: { order_no: 'abandoned-checkout', user_id: 'buyer' },
    },
  });
  expect(
    (await POST(other, { params: Promise.resolve({ provider: 'waffo' }) }))
      .status
  ).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(40);
  await deliverRefund();
  expect(await getRemainingCredits('buyer')).toBe(20);
});
it('rejects an over-refund and an original charged amount mismatch', async () => {
  await notify();
  expect(
    (await deliverRefund(refundRequest('over', { refundedAmount: '20.00' })))
      .status
  ).toBe(500);
  expect(
    (
      await deliverRefund(
        refundRequest('wrong-original', { originalChargedAmount: '29.99' })
      )
    ).status
  ).toBe(500);
  expect(await getRemainingCredits('buyer')).toBe(20);
});
it('uses the legacy refund amount rather than total, which describes the original payment', async () => {
  await notify();
  await deliverRefund(
    refundRequest('legacy-partial', {
      refundedAmount: undefined,
      amount: '5.00',
      total: '14.99',
      originalChargedAmount: undefined,
    })
  );
  expect(await getRemainingCredits('buyer')).toBe(20);
});
it('serializes payment and refund delivery so a race cannot regrant refunded credits', async () => {
  const responses = await Promise.all([notify(), deliverRefund()]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  expect(await getRemainingCredits('buyer')).toBe(0);
});

it('uses the actual charged amount for a full refund when it differs from list price', async () => {
  const paid = notification(0, false, {
    data: { chargedAmount: '5.00', total: '14.99', subtotal: '14.99' },
  });
  expect(
    (await POST(paid, { params: Promise.resolve({ provider: 'waffo' }) }))
      .status
  ).toBe(200);
  expect(
    (
      await deliverRefund(
        refundRequest('discounted', {
          refundedAmount: '5.00',
          amount: '5.00',
          originalChargedAmount: '5.00',
          total: '14.99',
        })
      )
    ).status
  ).toBe(200);
  expect(await getRemainingCredits('buyer')).toBe(0);
});

it('restores only the gift portion of a mixed generation debit after full order refund', async () => {
  await notify();
  await state.database.insert(credit).values({
    id: 'mixed-gift',
    userId: 'buyer',
    transactionNo: randomUUID(),
    transactionType: 'grant',
    transactionScene: 'gift',
    credits: 3,
    remainingCredits: 3,
    status: 'active',
  });
  const debit = await consumeCredits({ userId: 'buyer', credits: 22 });
  await deliverRefund();
  expect(await getRemainingCredits('buyer')).toBe(1);
  await refundConsumedCredits({ userId: 'buyer', creditId: debit.id });
  expect(await getRemainingCredits('buyer')).toBe(3);
});

it('records the actual recovered credits when a late payment supplies a missing stored charge amount', async () => {
  await notify();
  await state.database.execute(
    (await import('drizzle-orm'))
      .sql`UPDATE "order" SET payment_amount=NULL WHERE order_no='paid-checkout'`
  );
  await deliverRefund(
    refundRequest('late-amount', { originalChargedAmount: undefined })
  );
  expect(await getRemainingCredits('buyer')).toBe(20);
  await notify();
  expect(await getRemainingCredits('buyer')).toBe(0);
  const row = (await state.database.select().from(order)).find(
    (r: any) => r.orderNo === 'paid-checkout'
  );
  expect(JSON.parse(row.refundInfo).events[0].recoveredCredits).toBe(20);
});
