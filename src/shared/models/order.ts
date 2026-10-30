import { and, count, desc, eq, inArray, ne } from 'drizzle-orm';

import { db } from '@/core/db';
import {
  credit,
  order,
  subscription,
  user as userTable,
} from '@/config/db/schema';
import { PaymentType } from '@/extensions/payment/types';
import {
  parseRefundLedger,
  resolveRefundLedger,
} from '@/shared/lib/payment-refund';

import { NewCredit } from './credit';
import { revokeOrderGrant } from './payment-refund';
import {
  NewSubscription,
  UpdateSubscription,
  updateSubscriptionBySubscriptionNo,
} from './subscription';
import { appendUserToResult, User } from './user';

export type Order = typeof order.$inferSelect & {
  user?: User;
};
export type NewOrder = typeof order.$inferInsert;
export type UpdateOrder = Partial<
  Omit<NewOrder, 'id' | 'orderNo' | 'createdAt'>
>;

export enum OrderStatus {
  // processing status
  PENDING = 'pending', // order saved, waiting for checkout
  CREATED = 'created', // checkout success
  // final status
  COMPLETED = 'completed', // checkout completed, but failed
  PAID = 'paid', // order paid success
  REFUNDED = 'refunded',
  FAILED = 'failed', // order paid, but failed
}

/**
 * create order
 */
export async function createOrder(newOrder: NewOrder) {
  const [result] = await db().insert(order).values(newOrder).returning();

  return result;
}

/**
 * get orders
 */
export async function getOrders({
  orderNo,
  userId,
  status,
  getUser,
  paymentType,
  paymentProvider,
  page = 1,
  limit = 30,
}: {
  orderNo?: string;
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  getUser?: boolean;
  paymentType?: PaymentType;
  paymentProvider?: string;
  page?: number;
  limit?: number;
} = {}): Promise<Order[]> {
  const result = await db()
    .select()
    .from(order)
    .where(
      and(
        orderNo ? eq(order.orderNo, orderNo) : undefined,
        userId ? eq(order.userId, userId) : undefined,
        status
          ? Array.isArray(status)
            ? inArray(order.status, status)
            : eq(order.status, status)
          : undefined,
        paymentType ? eq(order.paymentType, paymentType) : undefined,
        paymentProvider ? eq(order.paymentProvider, paymentProvider) : undefined
      )
    )
    .orderBy(desc(order.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  if (getUser) {
    return appendUserToResult(result);
  }

  return result;
}

/**
 * get orders count
 */
export async function getOrdersCount({
  orderNo,
  userId,
  paymentType,
  status,
  paymentProvider,
}: {
  orderNo?: string;
  userId?: string;
  paymentType?: PaymentType;
  paymentProvider?: string;
  status?: OrderStatus | OrderStatus[];
} = {}): Promise<number> {
  const [result] = await db()
    .select({ count: count() })
    .from(order)
    .where(
      and(
        orderNo ? eq(order.orderNo, orderNo) : undefined,
        userId ? eq(order.userId, userId) : undefined,
        status
          ? Array.isArray(status)
            ? inArray(order.status, status)
            : eq(order.status, status)
          : undefined,
        paymentType ? eq(order.paymentType, paymentType) : undefined,
        paymentProvider ? eq(order.paymentProvider, paymentProvider) : undefined
      )
    );

  return result?.count || 0;
}

/**
 * find order by id
 */
export async function findOrderById(id: string) {
  const [result] = await db().select().from(order).where(eq(order.id, id));

  return result;
}

/**
 * find order by order no
 */
export async function findOrderByOrderNo(orderNo: string) {
  const [result] = await db()
    .select()
    .from(order)
    .where(eq(order.orderNo, orderNo));

  return result;
}

/**
 * update order
 */
export async function updateOrderByOrderNo(
  orderNo: string,
  updateOrder: UpdateOrder
) {
  const [result] = await db()
    .update(order)
    .set(updateOrder)
    .where(
      and(
        eq(order.orderNo, orderNo),
        updateOrder.status && updateOrder.status !== OrderStatus.REFUNDED
          ? ne(order.status, OrderStatus.REFUNDED)
          : undefined
      )
    )
    .returning();

  return result;
}

/**
 * update order by order id
 */
export async function updateOrderByOrderId(
  orderId: string,
  updateOrder: UpdateOrder
) {
  const [result] = await db()
    .update(order)
    .set(updateOrder)
    .where(eq(order.id, orderId))
    .returning();

  return result;
}

export async function updateOrderInTransaction({
  orderNo,
  updateOrder,
  newSubscription,
  newCredit,
}: {
  orderNo: string;
  updateOrder: UpdateOrder;
  newSubscription?: NewSubscription;
  newCredit?: NewCredit;
}) {
  if (!orderNo || !updateOrder) {
    throw new Error('orderNo and updateOrder are required');
  }

  // only update order, no need transaction
  if (!newSubscription && !newCredit) {
    return updateOrderByOrderNo(orderNo, updateOrder);
  }

  // need transaction
  const result = await db().transaction(async (tx) => {
    // All credit mutation paths lock user -> order -> grants, matching consumption.
    const [owner] = await tx
      .select({ userId: order.userId })
      .from(order)
      .where(eq(order.orderNo, orderNo));
    if (!owner) throw new Error('Order not found');
    await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.id, owner.userId))
      .for('no key update');
    // Lock before checking/creating grants: repeated webhook requests serialize here.
    const [lockedOrder] = await tx
      .select()
      .from(order)
      .where(eq(order.orderNo, orderNo))
      .for('update');
    if (!lockedOrder) throw new Error('Order not found');
    if (
      newCredit &&
      (newCredit.userId !== lockedOrder.userId || newCredit.orderNo !== orderNo)
    ) {
      throw new Error('Credit does not match order');
    }
    let effectiveUpdate = updateOrder;
    let suppressGrant = false;
    if (lockedOrder.refundInfo) {
      const paidAmount = updateOrder.paymentAmount ?? lockedOrder.paymentAmount;
      const ledger = parseRefundLedger(lockedOrder.refundInfo);
      for (const event of ledger.events) {
        if (
          event.currency !==
          (
            updateOrder.paymentCurrency ||
            lockedOrder.paymentCurrency ||
            lockedOrder.currency
          ).toUpperCase()
        )
          throw new Error('Refund currency does not match payment');
      }
      const next = resolveRefundLedger(
        ledger,
        paidAmount,
        updateOrder.transactionId || lockedOrder.transactionId
      );
      suppressGrant = next.fullyRefunded;
      if (suppressGrant) {
        const fullEvent = next.events.find(
          (e) =>
            e.status === 'succeeded' &&
            e.amount === (paidAmount || e.originalChargedAmount)
        )!;
        const recovered = await revokeOrderGrant(
          tx,
          lockedOrder.userId,
          orderNo,
          fullEvent.id
        );
        fullEvent.recoveredCredits =
          (fullEvent.recoveredCredits || 0) + recovered;
      }
      effectiveUpdate = {
        ...updateOrder,
        refundInfo: JSON.stringify(next),
        ...(suppressGrant ? { status: OrderStatus.REFUNDED } : {}),
      };
    }
    let result: any = {
      order: null,
      subscription: null,
      credit: null,
    };

    // deal with subscription
    if (newSubscription) {
      let existingSubscription: any = null;
      if (newSubscription.subscriptionId && newSubscription.paymentProvider) {
        // not create subscription with same subscription id and payment provider
        const [existingSubscriptionResult] = await tx
          .select()
          .from(subscription)
          .where(
            and(
              eq(subscription.subscriptionId, newSubscription.subscriptionId),
              eq(subscription.paymentProvider, newSubscription.paymentProvider)
            )
          );

        existingSubscription = existingSubscriptionResult;
      }

      if (!existingSubscription) {
        // create subscription
        const [subscriptionResult] = await tx
          .insert(subscription)
          .values(newSubscription)
          .returning();

        existingSubscription = subscriptionResult;
      }

      result.subscription = existingSubscription;
    }

    // deal with credit
    if (newCredit && !suppressGrant) {
      // not create credit with same order no
      let [existingCredit] = await tx
        .select()
        .from(credit)
        .where(
          and(eq(credit.orderNo, orderNo), eq(credit.transactionType, 'grant'))
        );

      if (!existingCredit) {
        // create credit
        const [creditResult] = await tx
          .insert(credit)
          .values(newCredit)
          .returning();

        existingCredit = creditResult;
      }

      result.credit = existingCredit;
    }

    // update order
    const [orderResult] = await tx
      .update(order)
      .set(effectiveUpdate)
      .where(eq(order.orderNo, orderNo))
      .returning();

    result.order = orderResult;

    return result;
  });

  return result;
}

export async function updateSubscriptionInTransaction({
  subscriptionNo,
  updateSubscription,
  newOrder,
  newCredit,
}: {
  subscriptionNo: string; // subscription unique id in table
  updateSubscription: UpdateSubscription;
  newOrder?: NewOrder;
  newCredit?: NewCredit;
}) {
  if (!subscriptionNo || !updateSubscription) {
    throw new Error('subscriptionNo and updateSubscription are required');
  }

  // only update order, no need transaction
  if (!newOrder && !newCredit) {
    return updateSubscriptionBySubscriptionNo(
      subscriptionNo,
      updateSubscription
    );
  }

  // need transaction
  const result = await db().transaction(async (tx) => {
    const [lockedSubscription] = await tx
      .select()
      .from(subscription)
      .where(eq(subscription.subscriptionNo, subscriptionNo))
      .for('update');
    if (!lockedSubscription) throw new Error('Subscription not found');
    let result: any = {
      order: null,
      subscription: null,
      credit: null,
    };

    // deal with order
    if (newOrder) {
      let existingOrder: any = null;
      if (newOrder.transactionId && newOrder.paymentProvider) {
        // not create order with same payment transaction id and payment provider
        const [existingOrderResult] = await tx
          .select()
          .from(order)
          .where(
            and(
              eq(order.transactionId, newOrder.transactionId),
              eq(order.paymentProvider, newOrder.paymentProvider)
            )
          );

        existingOrder = existingOrderResult;
      }

      if (!existingOrder) {
        // create order
        const [orderResult] = await tx
          .insert(order)
          .values(newOrder)
          .returning();

        existingOrder = orderResult;
      }

      result.order = existingOrder;
    }

    // deal with credit
    if (newCredit) {
      let existingCredit: any = null;
      if (result.order && result.order.orderNo) {
        // not create credit with same order no
        const [existingCreditResult] = await tx
          .select()
          .from(credit)
          .where(eq(credit.orderNo, result.order.orderNo));

        existingCredit = existingCreditResult;
      }

      if (!existingCredit) {
        // create credit
        const [creditResult] = await tx
          .insert(credit)
          .values(newCredit)
          .returning();

        existingCredit = creditResult;
      }

      result.credit = existingCredit;
    }

    // update subscription
    const [subscriptionResult] = await tx
      .update(subscription)
      .set(updateSubscription)
      .where(eq(subscription.subscriptionNo, subscriptionNo))
      .returning();

    result.subscription = subscriptionResult;

    return result;
  });

  return result;
}
