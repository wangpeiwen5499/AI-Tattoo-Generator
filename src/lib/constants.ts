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

/** 注册赠送 Credits 数量（与 users.credits DB default 对齐） */
export const FREE_SIGNUP_CREDITS = 3

/** 每次生成消耗的 Credits 数量（一次生成 4 张图） */
export const CREDITS_PER_GENERATION = 1

/** 上传限制 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB
export const ALLOWED_UPLOAD_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/**
 * Creem 定价档位。amount 单位：分（沿用 Stripe 美元分约定，Creem 也按此显示）。
 * Creem checkout 用 productId 引用 dashboard 预建的 product
 * （creemProductId 指向环境变量名，值在 .env.local）。
 */
export interface CreditPackage {
  id: string
  name: string
  credits: number
  /** 单位：美元分（499 = $4.99） */
  priceUsdCents: number
  /** Creem 价格描述，用于 checkout 显示 */
  description: string
  /** 该档位对应的 Creem product 环境变量名（值在 .env.local，如 CREEM_PRODUCT_STARTER） */
  creemProductId: string
  highlighted?: boolean
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    priceUsdCents: 499,
    description: '5 tattoo previews',
    creemProductId: 'CREEM_PRODUCT_STARTER',
  },
  {
    id: 'popular',
    name: 'Most Popular',
    credits: 20,
    priceUsdCents: 1499,
    description: '20 tattoo previews · Best value per preview',
    creemProductId: 'CREEM_PRODUCT_POPULAR',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsdCents: 2999,
    description: '50 tattoo previews · For serious shoppers',
    creemProductId: 'CREEM_PRODUCT_PRO',
  },
]

/** 根据 credits 数量查找套餐（Creem metadata 反查用） */
export function findPackageByCredits(credits: number): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.credits === credits)
}
