'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * 监听 URL 查询参数，显示付款反馈 toast，然后清理 URL。
 *
 * - ?success=true[&credits=N] → toast 成功（带 +N credits 描述）
 * - ?canceled=true → 不在这里处理（pricing-cards.tsx 处理）
 *
 * 渲染为 null，纯副作用组件。
 *
 * ⚠️ 必须在 Suspense 边界内使用（Next.js 16 + useSearchParams 强制要求）。
 */
export function PaymentFeedback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('success') !== 'true') return

    const creditsParam = searchParams.get('credits')
    const credits = creditsParam !== null ? Number(creditsParam) : NaN

    if (Number.isFinite(credits) && credits > 0) {
      toast.success('Payment successful!', {
        description: `+${credits} credits added to your account.`,
      })
    } else {
      toast.success('Payment successful!', {
        description: 'Your credits have been added.',
      })
    }

    // 清理 URL（移除 ?success=true，避免刷新重复弹 toast）
    router.replace('/')
  }, [searchParams, router])

  return null
}
