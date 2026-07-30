import { Creem } from 'creem'

/**
 * Creem 服务端单例（替换 lib/stripe.ts）。
 *
 * ⚠️ 只在服务端代码（API Route / server actions）中 import，
 * 不要 import 到任何 'use client' 文件或 middleware。
 *
 * CREEM_API_KEY 从 .env.local 读（test: creem_test_...，live: creem_...）。
 * server: test mode 用 'test'（指向 test-api.creem.io），生产省略（默认 api.creem.io）。
 */
function createCreemClient(): Creem {
  const apiKey = process.env.CREEM_API_KEY
  if (!apiKey) {
    throw new Error('CREEM_API_KEY is not set. Add it to .env.local')
  }
  return new Creem({
    apiKey,
    server: process.env.NODE_ENV === 'production' ? undefined : 'test',
  })
}

// Lazy 全局单例，避免每次调用都新建 client
let _creem: Creem | null = null
export function getCreem(): Creem {
  if (!_creem) _creem = createCreemClient()
  return _creem
}
