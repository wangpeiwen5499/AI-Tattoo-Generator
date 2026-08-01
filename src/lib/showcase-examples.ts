/**
 * 首页 showcase 示例图数据（纯数据，不依赖 env / R2 SDK）。
 *
 * ⚠️ 临时占位（2026-08-01）：当前用内联 SVG data URI（彩色卡 + 题材名）预览布局，
 * 零网络依赖（本地/生产都稳定，避免国内访问国外占位图服务受限）。
 * 确认保留 showcase 功能后，换真实纹身融合图：
 *   跑 scripts/gen-showcase.mjs（KIE + 无脸身体照 → R2 showcase/<slug>.png），
 *   并把这里改回 { key: 'showcase/<slug>.png', alt }，page.tsx 恢复 getPublicUrl。
 */
export type ShowcaseExample = { url: string; alt: string }

/** 生成纯色 + 题材名的 SVG 占位图（data URI，无网络依赖） */
function placeholder(color: string, text: string): string {
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><rect width='600' height='800' fill='%23${color}'/><text x='50%25' y='50%25' font-size='56' fill='white' text-anchor='middle' dominant-baseline='middle' font-family='sans-serif' font-weight='bold'>${text}</text></svg>`
}

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  { url: placeholder('dc2626', 'Dragon'), alt: 'Dragon tattoo preview' },
  { url: placeholder('ec4899', 'Rose'), alt: 'Rose tattoo preview' },
  { url: placeholder('ea580c', 'Koi'), alt: 'Koi fish tattoo preview' },
  { url: placeholder('525252', 'Skull'), alt: 'Skull tattoo preview' },
  { url: placeholder('7c3aed', 'Mandala'), alt: 'Mandala tattoo preview' },
  { url: placeholder('16a34a', 'Snake'), alt: 'Snake tattoo preview' },
  { url: placeholder('2563eb', 'Butterfly'), alt: 'Butterfly tattoo preview' },
  { url: placeholder('f97316', 'Phoenix'), alt: 'Phoenix tattoo preview' },
]
