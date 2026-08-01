/**
 * 首页 showcase 示例图数据（纯数据，不依赖 env / R2 SDK）。
 * 直接用 R2 public URL（图由用户上传到 uploads/samples/）。
 */
export type ShowcaseExample = { url: string; alt: string }

export const SHOWCASE_EXAMPLES: ShowcaseExample[] = [
  { url: 'https://pub-09b8af828637484ca056b0f2d8067a94.r2.dev/uploads/samples/left%20arm.jpg', alt: 'Left arm preview' },
  { url: 'https://pub-09b8af828637484ca056b0f2d8067a94.r2.dev/uploads/samples/left.jpg', alt: 'Left side preview' },
  { url: 'https://pub-09b8af828637484ca056b0f2d8067a94.r2.dev/uploads/samples/right%20arm.jpg', alt: 'Right arm preview' },
  { url: 'https://pub-09b8af828637484ca056b0f2d8067a94.r2.dev/uploads/samples/shoulder.jpg', alt: 'Shoulder preview' },
]
