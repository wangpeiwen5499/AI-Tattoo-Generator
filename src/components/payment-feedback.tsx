'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * 监听 URL 查询参数 ?success=true，显示付款成功 toast，然后清理 URL。
 *
 * 方案 A（Creem 迁移）：success_url 只设了 /?success=true（Creem 会追加自己的 query，
 * 但代码不依赖它，没有 credits=N）。检测 success=true → 弹通用 toast + dispatch
 * 'credits:refresh' 信号通知 TattooGenerator 刷新余额。webhook 异步发放 credits，
 * TattooGenerator 收到信号后会立即 refresh + 2.5s 后兜底再 refresh 一次。
 *
 * 渲染为 null，纯副作用组件。
 * ⚠️ 必须在 Suspense 边界内使用（Next.js 16 + useSearchParams 强制要求）。
 */
export function PaymentFeedback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('success') !== 'true') return

    toast.success('Payment successful!', {
      description: 'Your credits have been added.',
    })

    // 通知 TattooGenerator 刷新余额（webhook 异步，TattooGenerator 会延迟重试兜底）
    window.dispatchEvent(new CustomEvent('credits:refresh'))

    // 清理 URL（移除 ?success=true，避免刷新重复弹 toast）
    router.replace('/')
  }, [searchParams, router])

  return null
}
