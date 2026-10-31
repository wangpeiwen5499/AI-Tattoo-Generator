import { expect, it } from 'vitest';

import enCommon from '@/config/locale/messages/en/common.json';
import enPricing from '@/config/locale/messages/en/pages/pricing.json';
import zhCommon from '@/config/locale/messages/zh/common.json';
import zhPricing from '@/config/locale/messages/zh/pages/pricing.json';

const products = [
  ['PROD_5GdIMzJzJlUpdrBCyuaX2x', '$4.99', 4.99, 5],
  ['PROD_10hOkpFlMDiWFiqLxcWXHi', '$14.99', 14.99, 20],
  ['PROD_1COeqPCRSNk89LbIyHYnC', '$29.99', 29.99, 50],
];

it.each([
  ['en', enPricing, enCommon],
  ['zh', zhPricing, zhCommon],
] as const)(
  'preserves %s real checkout products while removing fixed output promises',
  (locale, pricing, common) => {
    const items = pricing.page.sections.pricing.items;
    expect(
      items.map((item) => [
        item.product_id,
        item.price,
        item.amount,
        item.credits,
      ])
    ).toEqual(products);
    for (const item of items) {
      expect(item.payment_product_id).toBe(item.product_id);
      expect(item.payment_providers).toEqual(['waffo']);
      expect(item.button.title).toBeTruthy();
      expect(item.features.join(' ')).toContain('1 / 2 / 3');
    }
    const text = JSON.stringify([pricing, common]);
    expect(text).not.toMatch(
      /complete sets?|per set|four body previews|four placements|每组|4 张身体|测试积分|proposed|browser-local/i
    );
    expect(pricing.page.sections.faq.items.at(-1)?.answer).toContain(
      locale === 'zh'
        ? '部分退款人工处理'
        : 'Partial refunds require manual handling'
    );
    expect(pricing.page.sections.faq.items.at(-1)?.answer).toContain(
      locale === 'zh' ? '退还一次' : 'returned once'
    );
    expect(common.funnel.resolutionHelp).toContain('1K / 2K / 4K');
  }
);
