/**
 * 全站常量：身体部位、Credits 定价、上传限制。
 */

/** 4 个生成部位（与数据库 generations.body_part 枚举一致） */
export const BODY_PARTS = ['left_arm', 'right_arm', 'shoulder', 'calf'] as const
export type BodyPart = (typeof BODY_PARTS)[number]

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  left_arm: 'Left Arm',
  right_arm: 'Right Arm',
  shoulder: 'Shoulder',
  calf: 'Calf',
}

/** 注册赠送 Credits 数量 */
export const FREE_SIGNUP_CREDITS = 1

/** 每次生成消耗的 Credits 数量（一次生成 4 张图） */
export const CREDITS_PER_GENERATION = 1

/** 上传限制 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const ALLOWED_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Stripe 定价档位。amount 单位：分（Stripe 标准）。
 * Day 5 创建 Stripe Session 时直接用 price_data 传这些值，
 * 无需在 Stripe Dashboard 预先创建 Product。
 */
export interface CreditPackage {
  id: string
  name: string
  credits: number
  /** 单位：美元分（499 = $4.99） */
  priceUsdCents: number
  /** Stripe 价格描述，用于 checkout 显示 */
  description: string
  highlighted?: boolean
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    priceUsdCents: 499,
    description: '5 tattoo previews',
  },
  {
    id: 'popular',
    name: 'Most Popular',
    credits: 20,
    priceUsdCents: 1499,
    description: '20 tattoo previews · Best value per preview',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsdCents: 2999,
    description: '50 tattoo previews · For serious shoppers',
  },
]

/** 根据 credits 数量查找套餐（Stripe metadata 反查用） */
export function findPackageByCredits(credits: number): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.credits === credits)
}
