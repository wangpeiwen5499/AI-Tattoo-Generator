'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Show, SignInButton } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CREDIT_PACKAGES } from '@/lib/constants'
import type { CheckoutResponse, PackageId } from '@/types'

/**
 * 3 档定价卡片。
 *
 * - 已登录：点 Buy → POST /api/checkout → 跳转 Stripe
 * - 未登录：按钮变 "Sign in to buy"，点击弹 SignIn modal
 * - URL 查询参数：
 *   - ?canceled=true → toast「Checkout canceled」
 */
export function PricingCards() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loadingPackage, setLoadingPackage] = useState<PackageId | null>(null)
  const [canceledToastShown, setCanceledToastShown] = useState(false)

  // 处理 ?canceled=true（Toast + 清理 URL）
  const canceled = searchParams.get('canceled') === 'true'
  if (canceled && !canceledToastShown) {
    setCanceledToastShown(true)
    toast('Checkout was canceled', {
      description: 'No charge was made. Pick a package to try again.',
    })
    router.replace('/pricing')
  }

  async function handleBuy(packageId: PackageId) {
    setLoadingPackage(packageId)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Checkout failed (HTTP ${res.status})`)
      }
      const data: CheckoutResponse = await res.json()
      if (!data.url) throw new Error('Stripe returned no URL')
      // 跳转 Stripe Checkout（同窗口）
      window.location.href = data.url
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Checkout failed'
      toast.error(msg)
      setLoadingPackage(null)
    }
  }

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {CREDIT_PACKAGES.map((pkg) => {
        const unitPrice = (pkg.priceUsdCents / pkg.credits / 100).toFixed(2)
        const isHighlighted = pkg.highlighted === true

        return (
          <Card
            key={pkg.id}
            className={
              isHighlighted
                ? 'border-primary border-2 shadow-lg md:scale-105'
                : ''
            }
          >
            <CardHeader>
              {isHighlighted && (
                <div className="mb-1 inline-block w-fit rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                  Most Popular
                </div>
              )}
              <CardTitle className="text-xl">{pkg.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <span className="text-4xl font-bold tracking-tight">
                  ${pkg.priceUsdCents / 100}
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">{pkg.credits}</span>{' '}
                credits
              </div>

              <div className="text-xs text-muted-foreground">
                ${unitPrice} per preview
              </div>

              <ul className="flex flex-col gap-1.5 text-sm">
                <FeatureItem>{pkg.credits} tattoo previews</FeatureItem>
                <FeatureItem>4 body parts each (arm/shoulder/calf)</FeatureItem>
                <FeatureItem>High-resolution downloads</FeatureItem>
              </ul>

              <Show when="signed-in">
                <Button
                  size="lg"
                  variant={isHighlighted ? 'default' : 'outline'}
                  className="mt-2 w-full"
                  disabled={loadingPackage !== null}
                  onClick={() => handleBuy(pkg.id as PackageId)}
                >
                  {loadingPackage === pkg.id
                    ? 'Redirecting...'
                    : loadingPackage
                      ? '...'
                      : 'Get started'}
                </Button>
              </Show>

              <Show when="signed-out">
                <SignInButton mode="modal">
                  <Button
                    size="lg"
                    variant={isHighlighted ? 'default' : 'outline'}
                    className="mt-2 w-full"
                  >
                    Sign in to buy
                  </Button>
                </SignInButton>
              </Show>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  )
}
