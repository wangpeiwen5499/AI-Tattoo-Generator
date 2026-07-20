import Stripe from 'stripe'

/**
 * Stripe 服务端单例。
 *
 * ⚠️ 只在服务端代码（API Route / server actions）中 import，
 * 不要 import 到任何 'use client' 文件或 middleware。
 *
 * STRIPE_SECRET_KEY 从 .env.local 读，本地是 sk_test_...，生产是 sk_live_...。
 */
function createStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env.local')
  }
  return new Stripe(key, {
    // https://stripe.com/docs/api/versioning
    // 用 SDK 自带类型对应的版本（不传 apiVersion 会用账号默认）
    typescript: true,
  })
}

// Lazy 全局单例，避免每次调用都新建 client
let _stripe: Stripe | null = null
export function getStripe(): Stripe {
  if (!_stripe) _stripe = createStripeClient()
  return _stripe
}
