import { expect, it } from 'vitest';

import en from '@/config/locale/messages/en/pages/pricing.json';
import zh from '@/config/locale/messages/zh/pages/pricing.json';

it('maps the 50-credit package to the verified full Waffo ID in both languages', () => {
  for (const messages of [en, zh]) {
    const pro = messages.page.sections.pricing.items.find(
      (item) => item.amount === 29.99
    )!;
    expect(pro.product_id).toBe('PROD_1COeqPCRSNk89LbIyHY5nC');
    expect(pro.payment_product_id).toBe('PROD_1COeqPCRSNk89LbIyHY5nC');
    expect(pro.credits).toBe(50);
  }
});
