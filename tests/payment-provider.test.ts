import { describe, expect, it } from 'vitest';

import { WaffoProvider } from '@/extensions/payment/waffo';

describe('Waffo money normalization', () => {
  it('stores display dollars as integer cents, with separate subtotal and total', () => {
    const provider = new WaffoProvider({
      merchantId: 'test',
      privateKey: 'test',
    });
    const payment = (provider as any).buildPaymentSessionFromOrder({
      amount: '5.49',
      subtotal: '4.99',
      total: '5.49',
      currency: 'USD',
      orderId: 'test-order',
    });
    expect(payment.paymentInfo.amount).toBe(499);
    expect(payment.paymentInfo.paymentAmount).toBe(549);
  });
});
