/** Product experiments must never follow NODE_ENV or a public client flag. */
export function isProductPreview() {
  return process.env.VERCEL_ENV === 'preview';
}

export function studioUrl(panel?: 'designs' | 'history', locale?: string) {
  const query = new URLSearchParams();
  if (panel) query.set('panel', panel);
  if (locale === 'en') query.set('lang', 'en');
  return `/try-on-lab/index.html${query.size ? `?${query}` : ''}`;
}

export const previewPacks = [
  { price: '$4.99', credits: 5 },
  { price: '$14.99', credits: 20 },
  { price: '$29.99', credits: 50 },
] as const;

export function previewNotice(locale: string) {
  return locale === 'zh'
    ? 'Preview 测试版 · 仅使用独立测试积分，不扣真实账户积分。实际 AI 请求会产生 KIE 测试费用，提交前需明确同意。设计库与试戴历史仅保存在当前浏览器，不与账户同步。'
    : 'Preview prototype · Uses separate test credits, never real account credits. Actual AI requests incur KIE test costs and require explicit consent. Designs and try-on history stay in this browser, without account sync.';
}
