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

it('uses a separate plan name and localized credit terminology', () => {
  const plus = en.page.sections.pricing.items[1];
  expect(plus.title).toBe('Plus');
  expect(plus.label).toBe('Most Popular');
  const visibleChinese = JSON.stringify(zh.page).replace(/"credits":\d+/g, '');
  expect(visibleChinese).not.toMatch(/\bcredits?\b/);
});

it('explains complete design and try-on workflow costs in both languages', () => {
  for (const messages of [en, zh]) {
    const example = messages.page.sections.faq.items[2].answer;
    expect(example).toContain('1K');
    expect(example).toContain('2K');
    expect(example).toContain('4K');
    expect(example).toContain('5');
  }
});
