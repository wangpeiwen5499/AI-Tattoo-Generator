import { WaffoPancake } from '@waffo/pancake-ts'

/**
 * Waffo Pancake 服务端单例（替换 lib/creem.ts）。
 *
 * ⚠️ 只在服务端（API Route）import，不要进 'use client' 或 middleware
 *    （private key 不能泄露到浏览器）。
 *
 * WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY 从 .env.local 读。
 * private key 支持 PEM / escaped \n / base64，SDK auto-normalize。
 */
function createWaffoClient(): WaffoPancake {
  const merchantId = process.env.WAFFO_MERCHANT_ID
  const privateKey = process.env.WAFFO_PRIVATE_KEY
  if (!merchantId || !privateKey) {
    throw new Error('WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY not set. Add to .env.local')
  }
  return new WaffoPancake({ merchantId, privateKey })
}

// Lazy 全局单例，避免每次调用都新建 client
let _waffo: WaffoPancake | null = null
export function getWaffo(): WaffoPancake {
  if (!_waffo) _waffo = createWaffoClient()
  return _waffo
}
