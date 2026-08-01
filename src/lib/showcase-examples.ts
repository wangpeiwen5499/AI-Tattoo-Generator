/**
 * 首页 showcase 示例图数据（纯数据，不依赖 env / R2 SDK）。
 * key 对应 R2 对象 key（由 scripts/gen-showcase.mjs 生成到 showcase/<slug>.png）。
 * URL 由 page.tsx（Server）用 getPublicUrl(key) 解析，避免把 R2 SDK 带进 Client bundle。
 */
export type ShowcaseExample = { key: string; alt: string }

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  { key: 'showcase/dragon.png', alt: 'Dragon tattoo preview' },
  { key: 'showcase/rose.png', alt: 'Rose tattoo preview' },
  { key: 'showcase/koi.png', alt: 'Koi fish tattoo preview' },
  { key: 'showcase/skull.png', alt: 'Skull tattoo preview' },
  { key: 'showcase/mandala.png', alt: 'Mandala tattoo preview' },
  { key: 'showcase/snake.png', alt: 'Snake tattoo preview' },
  { key: 'showcase/butterfly.png', alt: 'Butterfly tattoo preview' },
  { key: 'showcase/phoenix.png', alt: 'Phoenix tattoo preview' },
]
