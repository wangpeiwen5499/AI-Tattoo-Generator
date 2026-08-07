/**
 * 全站常量：身体部位、Credits 定价、上传限制（从 Demo 迁入 ShipAny Two）。
 */

/** 4 个生成部位（与 tattoo 业务表 body_part 枚举一致） */
export const BODY_PARTS = ['left_arm', 'right_arm', 'shoulder', 'calf'] as const
export type BodyPart = (typeof BODY_PARTS)[number]

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  left_arm: 'Left Arm',
  right_arm: 'Right Arm',
  shoulder: 'Shoulder',
  calf: 'Calf',
}

/** 注册赠送 Credits 数量 */
export const FREE_SIGNUP_CREDITS = 3

/** 每次生成消耗的 Credits 数量（一次生成 4 张图） */
export const CREDITS_PER_GENERATION = 1

/** 上传限制 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const ALLOWED_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Waffo 定价档位。amount 单位：美元分。
 */
export interface CreditPackage {
  id: string
  name: string
  credits: number
  /** 单位：美元分（499 = $4.99） */
  priceUsdCents: number
  description: string
  /** 该档位对应的 Waffo product 环境变量名 */
  waffoProductId: string
  highlighted?: boolean
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    priceUsdCents: 499,
    description: '5 tattoo previews',
    waffoProductId: 'WAFFO_PRODUCT_STARTER',
  },
  {
    id: 'popular',
    name: 'Most Popular',
    credits: 20,
    priceUsdCents: 1499,
    description: '20 tattoo previews · Best value per preview',
    waffoProductId: 'WAFFO_PRODUCT_POPULAR',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsdCents: 2999,
    description: '50 tattoo previews · For serious shoppers',
    waffoProductId: 'WAFFO_PRODUCT_PRO',
  },
]

/** 根据 credits 数量查找套餐（Waffo metadata 反查用） */
export function findPackageByCredits(credits: number): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.credits === credits)
}
