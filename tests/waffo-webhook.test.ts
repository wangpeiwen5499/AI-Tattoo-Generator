import { createSign, generateKeyPairSync, randomUUID } from 'node:crypto';
import { POST } from '@/app/api/payment/notify/[provider]/route';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

import { credit, order, user } from '@/config/db/schema';
import { consumeCredits, getRemainingCredits } from '@/shared/models/credit';

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
function notification(ageMinutes = 0, tampered = false) {
  const payload = JSON.stringify({
    id: 'event-1',
    eventId: 'event-1',
    eventType: 'order.completed',
    mode: 'prod',
    data: {
      orderId: 'waffo-paid-order',
      buyerEmail: 'buyer@example.com',
      amount: '14.99',
      subtotal: '14.99',
      total: '14.99',
      currency: 'USD',
      orderMetadata: { order_no: 'paid-checkout', user_id: 'buyer' },
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
