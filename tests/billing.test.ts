import { randomUUID } from 'node:crypto';
import { claimUpload } from '@/server/db/guest-queries';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { credit, order, user } from '@/config/db/schema';
import {
  consumeCredits,
  getRemainingCredits,
  refundConsumedCredits,
} from '@/shared/models/credit';
import { updateOrderInTransaction } from '@/shared/models/order';

import { createTestDatabase } from './database';

const state = vi.hoisted(() => ({ database: null as any }));
vi.mock('@/core/db', () => ({ db: () => state.database }));
vi.mock('@/shared/models/user', () => ({
  appendUserToResult: (x: unknown) => x,
}));
vi.mock('@/shared/models/config', () => ({ getAllConfigs: () => ({}) }));

let close: () => Promise<void>;
const userId = 'billing-test-user';
async function grant(amount: number) {
  await state.database.insert(credit).values({
    id: randomUUID(),
    userId,
    transactionNo: randomUUID(),
    transactionType: 'grant',
    transactionScene: 'payment',
    credits: amount,
    remainingCredits: amount,
    status: 'active',
  });
}

describe('billing transactions (isolated PostgreSQL)', () => {
  beforeAll(async () => {
    const test = await createTestDatabase();
    state.database = test.database;
    close = () => test.client.close();
  });
  afterAll(async () => close?.());
  beforeEach(async () => {
    await state.database.delete(credit);
    await state.database.delete(order);
    await state.database.delete(user);
    await state.database
      .insert(user)
      .values({ id: userId, name: 'Test', email: 'test@example.com' });
  });

  it('rejects zero, negative and fractional consumption without writing records', async () => {
    await grant(3);
    for (const credits of [0, -1, 0.5, NaN, Infinity]) {
      await expect(consumeCredits({ userId, credits })).rejects.toThrow();
    }
    expect(await getRemainingCredits(userId)).toBe(3);
    expect(await state.database.select().from(credit)).toHaveLength(1);
  });

  it('consumes across more than ten grants without skipping records', async () => {
    for (let i = 0; i < 15; i++) await grant(1);
    await consumeCredits({ userId, credits: 15 });
    expect(await getRemainingCredits(userId)).toBe(0);
  });

  it('rolls back an insufficient debit, including its consumption record', async () => {
    await grant(1);
    await expect(consumeCredits({ userId, credits: 2 })).rejects.toThrow(
      /Insufficient/
    );
    expect(await getRemainingCredits(userId)).toBe(1);
    expect(await state.database.select().from(credit)).toHaveLength(1);
  });

  it('permits only one purchase of the last credit', async () => {
    await grant(1);
    const attempts = await Promise.allSettled([
      consumeCredits({ userId, credits: 1 }),
      consumeCredits({ userId, credits: 1 }),
    ]);
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await getRemainingCredits(userId)).toBe(0);
  });

  it('refunds a consumption only once and never a different user', async () => {
    await grant(3);
    const debit = await consumeCredits({ userId, credits: 1 });
    await expect(
      refundConsumedCredits({ userId: 'other-user', creditId: debit.id })
    ).rejects.toThrow();
    expect(await getRemainingCredits(userId)).toBe(2);
    await Promise.all([
      refundConsumedCredits({ userId, creditId: debit.id }),
      refundConsumedCredits({ userId, creditId: debit.id }),
    ]);
    expect(await getRemainingCredits(userId)).toBe(3);
    expect(
      (
        await state.database
          .select()
          .from(credit)
          .where(eq(credit.id, debit.id))
      )[0].status
    ).toBe('deleted');
  });

  it('cannot grant payment credits for a nonexistent order', async () => {
    await expect(
      updateOrderInTransaction({
        orderNo: 'missing',
        updateOrder: { status: 'paid' },
        newCredit: {
          id: randomUUID(),
          userId,
          transactionNo: randomUUID(),
          orderNo: 'missing',
          transactionType: 'grant',
          credits: 5,
          remainingCredits: 5,
          status: 'active',
        },
      })
    ).rejects.toThrow();
    expect(await getRemainingCredits(userId)).toBe(0);
  });

  it('grants once for repeated payment completion', async () => {
    await state.database
      .insert(order)
      .values({
        id: randomUUID(),
        orderNo: 'paid-order',
        userId,
        userEmail: 'test@example.com',
        status: 'created',
        amount: 499,
        currency: 'USD',
        paymentType: 'one-time',
        paymentProvider: 'waffo',
        checkoutInfo: '{}',
      });
    const complete = () =>
      updateOrderInTransaction({
        orderNo: 'paid-order',
        updateOrder: { status: 'paid' },
        newCredit: {
          id: randomUUID(),
          userId,
          transactionNo: randomUUID(),
          orderNo: 'paid-order',
          transactionType: 'grant',
          credits: 5,
          remainingCredits: 5,
          status: 'active',
        },
      });
    await Promise.all([complete(), complete()]);
    expect(await getRemainingCredits(userId)).toBe(5);
  });

  it('enforces upload budgets even when guest cookies are rotated', async () => {
    const ip = randomUUID();
    expect(await claimUpload(ip, 2)).toBe(1);
    expect(await claimUpload(ip, 2)).toBe(2);
    expect(await claimUpload(ip, 2)).toBe(-1);
  });
});
