/** Product experiments must never follow NODE_ENV or a public client flag. */
export function isProductPreview() {
  return process.env.VERCEL_ENV === 'preview';
}

/** Studio URL: the editor itself, or the standalone account list pages. */
export function studioUrl(
  panel?: 'designs' | 'history',
  locale?: string
): string {
  const base = locale === 'zh' ? '/zh' : '';
  const path =
    panel === 'designs' ? '/designs' : panel === 'history' ? '/history' : '/studio';
  return `${base}${path}`;
}

export function previewNotice(locale: string) {
  return locale === 'zh'
    ? '预发环境：使用隔离数据库中的 TattooVis 账户与积分，与正式站数据完全隔离；购买暂未开放。'
    : 'Preview environment: TattooVis accounts and credits live in an isolated database, fully separated from the live site; purchasing is not available yet.';
}
