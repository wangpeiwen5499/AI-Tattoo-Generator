/**
 * 全站常量：身体部位、Credits 定价、上传限制（从 Demo 迁入 ShipAny Two）。
 */

/** 4 个生成部位（与 tattoo 业务表 body_part 枚举一致） */
export const BODY_PARTS = [
  'left_arm',
  'right_arm',
  'shoulder',
  'calf',
] as const;
export type BodyPart = (typeof BODY_PARTS)[number];

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  left_arm: 'Left Arm',
  right_arm: 'Right Arm',
  shoulder: 'Shoulder',
  calf: 'Calf',
};

/** 注册赠送 Credits 数量 */
export const FREE_SIGNUP_CREDITS = 3;

/** Legacy/default 1K cost. Resolution-specific jobs use tattooResolutionPolicy. */
export const CREDITS_PER_GENERATION = 1;

/** 上传限制 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Waffo 定价档位。amount 单位：美元分。
 */
export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  /** 单位：美元分（499 = $4.99） */
  priceUsdCents: number;
  description: string;
  /** 该档位对应的 Waffo product 环境变量名 */
  waffoProductId: string;
  highlighted?: boolean;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    priceUsdCents: 499,
    description: '5 credits · 1K/2K/4K cost 1/2/3 credits per set',
    waffoProductId: 'WAFFO_PRODUCT_STARTER',
  },
  {
    id: 'popular',
    name: 'Most Popular',
    credits: 20,
    priceUsdCents: 1499,
    description: '20 credits · Mix 1K, 2K and 4K preview sets',
    waffoProductId: 'WAFFO_PRODUCT_POPULAR',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsdCents: 2999,
    description: '50 credits · Mix 1K, 2K and 4K preview sets',
    waffoProductId: 'WAFFO_PRODUCT_PRO',
  },
];

/** 根据 credits 数量查找套餐（Waffo metadata 反查用） */
export function findPackageByCredits(
  credits: number
): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.credits === credits);
}
