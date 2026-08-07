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
    const { WaffoPancake } = require('@waffo/pancake-ts') as typeof import('@waffo/pancake-ts');
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
      const { verifyWebhook, WebhookEventType } = require('@waffo/pancake-ts') as typeof import('@waffo/pancake-ts');

      const rawBody = await req.text();
      const signature = req.headers.get('x-waffo-signature');

      if (!rawBody || !signature) {
        throw new Error('Invalid webhook request');
      }

      // verifyWebhook uses built-in public keys (no webhook secret needed)
      const event = verifyWebhook<Record<string, any>>(rawBody, signature);

      if (!event || !event.eventType) {
        throw new Error('Invalid webhook payload');
      }

      let paymentSession: PaymentSession | undefined = undefined;

      const eventType = this.mapWaffoEventType(event.eventType);

      if (eventType === PaymentEventType.CHECKOUT_SUCCESS) {
        paymentSession = this.buildPaymentSessionFromOrder(event.data);
      } else if (eventType === PaymentEventType.PAYMENT_FAILED) {
        paymentSession = this.buildPaymentSessionFromOrder(event.data);
      } else if (eventType === PaymentEventType.PAYMENT_REFUNDED) {
        paymentSession = this.buildPaymentSessionFromOrder(event.data);
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
        return PaymentEventType.PAYMENT_FAILED;
      default:
        throw new Error(`Unknown Waffo event type: ${eventType}`);
    }
  }

  private buildPaymentSessionFromOrder(data: any): PaymentSession {
    const amount = data.amount ? parseFloat(data.amount) : 0;
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
        paymentAmount: amount,
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
