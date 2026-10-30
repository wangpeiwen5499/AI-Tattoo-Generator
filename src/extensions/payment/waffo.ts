import {
  CheckoutSession,
  PaymentBilling,
  PaymentConfigs,
  PaymentEvent,
  PaymentEventType,
  PaymentOrder,
  PaymentProvider,
  PaymentSession,
  PaymentStatus,
} from './types';

/**
 * Waffo payment provider configs
 * @docs https://docs.waffo.ai/
 */
export interface WaffoConfigs extends PaymentConfigs {
  merchantId: string;
  privateKey: string;
}

/**
 * Waffo Pancake payment provider implementation
 * @website https://waffo.ai/
 */
export class WaffoProvider implements PaymentProvider {
  readonly name = 'waffo';
  configs: WaffoConfigs;

  constructor(configs: WaffoConfigs) {
    this.configs = configs;
  }

  // lazy load WaffoPancake (avoid import at module level — breaks build if not installed)
  private getClient() {
    const { WaffoPancake } =
      require('@waffo/pancake-ts') as typeof import('@waffo/pancake-ts');
    return new WaffoPancake({
      merchantId: this.configs.merchantId,
      privateKey: this.configs.privateKey,
    });
  }

  // create payment
  async createPayment({
    order,
  }: {
    order: PaymentOrder;
  }): Promise<CheckoutSession> {
    try {
      if (!order.productId) {
        throw new Error('productId is required');
      }

      const client = this.getClient();

      const payload = {
        productId: order.productId,
        currency: order.price?.currency || 'USD',
        buyerEmail: order.customer?.email,
        successUrl: order.successUrl,
        metadata: order.metadata,
      };

      const result = await client.checkout.createSession(payload);

      if (!result || !result.sessionId) {
        throw new Error('create payment failed: no sessionId returned');
      }

      return {
        provider: this.name,
        checkoutParams: payload,
        checkoutInfo: {
          sessionId: result.sessionId,
          checkoutUrl: result.checkoutUrl,
        },
        checkoutResult: result,
        metadata: order.metadata || {},
      };
    } catch (error) {
      throw error;
    }
  }

  // get payment by session id
  // note: Waffo does not have a direct "get session by ID" API;
  // this returns a basic stub with whatever state we can infer.
  async getPaymentSession({
    sessionId,
  }: {
    sessionId: string;
  }): Promise<PaymentSession> {
    // Waffo doesn't expose a direct session retrieval endpoint.
    // Return a minimal session — the caller should query DB for full state.
    return {
      provider: this.name,
      paymentStatus: PaymentStatus.PROCESSING,
    };
  }

  async getPaymentEvent({ req }: { req: Request }): Promise<PaymentEvent> {
    try {
      const { verifyWebhook, WebhookEventType } =
        require('@waffo/pancake-ts') as typeof import('@waffo/pancake-ts');

      const rawBody = await req.text();
      const signature = req.headers.get('x-waffo-signature');

      if (!rawBody || !signature) {
        throw new Error('Invalid webhook request');
      }

      // verifyWebhook uses built-in public keys (no webhook secret needed)
      // Waffo retries retain the original signature timestamp; the final retry
      // can arrive after 31 minutes. Keep RSA verification and a bounded window.
      // Order-row locking and order-linked grants deduplicate successful retries.
      const event = verifyWebhook<Record<string, any>>(rawBody, signature, {
        toleranceMs: 45 * 60 * 1000,
      });

      if (!event || !event.eventType) {
        throw new Error('Invalid webhook payload');
      }

      let paymentSession: PaymentSession | undefined = undefined;

      const eventType = this.mapWaffoEventType(event.eventType);

      if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
        paymentSession = this.buildPaymentSessionFromOrder(event.data);
      } else if (eventType === PaymentEventType.PAYMENT_FAILED) {
        paymentSession = this.buildPaymentSessionFromOrder(event.data);
      } else if (
        eventType === PaymentEventType.PAYMENT_REFUNDED ||
        eventType === PaymentEventType.REFUND_FAILED
      ) {
        paymentSession = this.buildRefundSession(
          event.data,
          event.eventId || event.id,
          eventType === PaymentEventType.PAYMENT_REFUNDED
        );
      } else if (
        eventType === PaymentEventType.SUBSCRIBE_UPDATED ||
        eventType === PaymentEventType.SUBSCRIBE_CANCELED
      ) {
        paymentSession = { provider: this.name };
      }

      if (!paymentSession) {
        throw new Error('Invalid webhook event');
      }

      return {
        eventType: eventType,
        eventResult: event,
        paymentSession: paymentSession,
      };
    } catch (error) {
      throw error;
    }
  }

  async getPaymentBilling({
    customerId,
    returnUrl,
  }: {
    customerId: string;
    returnUrl?: string;
  }): Promise<PaymentBilling> {
    // Waffo doesn't have a customer billing portal
    throw new Error('Waffo does not support customer billing portal');
  }

  async cancelSubscription({
    subscriptionId,
  }: {
    subscriptionId: string;
  }): Promise<PaymentSession> {
    const client = this.getClient();
    try {
      const result = await client.orders.cancelSubscription({
        orderId: subscriptionId,
      });

      return {
        provider: this.name,
        subscriptionId,
        subscriptionResult: result,
      };
    } catch (error) {
      throw error;
    }
  }

  private mapWaffoEventType(eventType: string): PaymentEventType {
    switch (eventType) {
      case 'order.completed':
        return PaymentEventType.CHECKOUT_SUCCESS;
      case 'subscription.activated':
        return PaymentEventType.PAYMENT_SUCCESS;
      case 'subscription.payment_succeeded':
        return PaymentEventType.PAYMENT_SUCCESS;
      case 'subscription.canceling':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.uncanceled':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.updated':
        return PaymentEventType.SUBSCRIBE_UPDATED;
      case 'subscription.canceled':
        return PaymentEventType.SUBSCRIBE_CANCELED;
      case 'subscription.past_due':
        return PaymentEventType.PAYMENT_FAILED;
      case 'refund.succeeded':
        return PaymentEventType.PAYMENT_REFUNDED;
      case 'refund.failed':
        return PaymentEventType.REFUND_FAILED;
      default:
        throw new Error(`Unknown Waffo event type: ${eventType}`);
    }
  }

  private buildRefundSession(
    data: any,
    id: unknown,
    succeeded: boolean
  ): PaymentSession {
    if (
      !data ||
      typeof id !== 'string' ||
      !id ||
      typeof data.orderId !== 'string' ||
      !data.orderId
    )
      throw new Error('Missing Waffo refund identity');
    const status = succeeded ? 'succeeded' : 'failed';
    if (data.refundStatus && data.refundStatus !== status)
      throw new Error('Inconsistent Waffo refund status');
    const cents = (value: unknown): number | null => {
      if (value === undefined || value === null) return null;
      const text = String(value);
      if (!/^\d+(\.\d{1,2})?$/.test(text))
        throw new Error('Invalid Waffo refund amount');
      const result = Math.round(Number(text) * 100);
      if (!Number.isSafeInteger(result) || result <= 0)
        throw new Error('Invalid Waffo refund amount');
      return result;
    };
    if (typeof data.currency !== 'string' || !/^[A-Z]{3}$/i.test(data.currency))
      throw new Error('Invalid refund currency');
    return {
      provider: this.name,
      paymentStatus: succeeded ? PaymentStatus.REFUNDED : PaymentStatus.FAILED,
      paymentResult: data,
      metadata: {
        ...data.orderMetadata,
        order_no: data.orderMetadata?.order_no || data.orderMerchantExternalId,
      },
      refundInfo: {
        id,
        status,
        transactionId: data.orderId,
        paymentId: data.paymentId,
        amount: cents(data.refundedAmount ?? data.amount),
        originalChargedAmount: cents(data.originalChargedAmount),
        currency: data.currency.toUpperCase(),
      },
    };
  }

  private buildPaymentSessionFromOrder(data: any): PaymentSession {
    // Waffo's SDK defines webhook amounts as display strings; DB uses minor units.
    const amount = Math.round(Number(data.subtotal ?? data.amount) * 100);
    const paidAmount = Math.round(
      Number(data.chargedAmount ?? data.total ?? data.amount) * 100
    );
    if (
      !Number.isSafeInteger(amount) ||
      !Number.isSafeInteger(paidAmount) ||
      amount <= 0 ||
      paidAmount <= 0
    )
      throw new Error('Invalid Waffo amount');
    const currency = data.currency || 'USD';

    return {
      provider: this.name,
      paymentStatus: PaymentStatus.SUCCESS,
      paymentInfo: {
        transactionId: data.orderId,
        amount: amount,
        currency: currency,
        discountCode: '',
        discountAmount: 0,
        discountCurrency: currency,
        paymentAmount: paidAmount,
        paymentCurrency: currency,
        paymentEmail: data.buyerEmail,
        paymentUserId: data.merchantProvidedBuyerIdentity,
        paidAt: data.paymentDate ? new Date(data.paymentDate) : undefined,
        invoiceId: '',
        invoiceUrl: '',
      },
      paymentResult: data,
      metadata: data.orderMetadata || {},
    };
  }
}

/**
 * Create Waffo provider with configs
 */
export function createWaffoProvider(configs: WaffoConfigs): WaffoProvider {
  return new WaffoProvider(configs);
}
