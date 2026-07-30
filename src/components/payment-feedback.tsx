'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * 监听 URL 查询参数 ?success=true，显示付款成功 toast，然后清理 URL。
 *
 * 方案 A（Creem 迁移）：Creem 跳回 /?success=true&checkout_id=...（无 credits=N），
 * 故只用通用 toast；余额更新靠首页重新挂载时 useCredits 自动 fetch
 * （TattooGenerator 持有 useCredits，重新挂载即拉新余额）。
 * 不再 dispatch credits:added（无精确 amount，CreditsBadge 靠重新挂载显示新值）。
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

    // 清理 URL（移除 ?success=true，避免刷新重复弹 toast）
    router.replace('/')
  }, [searchParams, router])

  return null
}
