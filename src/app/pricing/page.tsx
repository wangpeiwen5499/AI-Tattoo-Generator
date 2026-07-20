import { Suspense } from 'react'
import { PricingCards } from '@/components/pricing-cards'

export const metadata = {
  title: 'Pricing — AI Tattoo Generator',
  description: 'Buy credits to generate more tattoo previews. One-time payment, no subscription.',
}

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Choose Your Credits Package
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground text-pretty">
          One-time payment · No subscription · Credits never expire
        </p>
      </section>

      <div className="mt-12">
        {/*
          Suspense 必需：PricingCards 用了 useSearchParams()，
          静态预渲染时需要 Suspense boundary（Next.js 强制要求）。
        */}
        <Suspense fallback={null}>
          <PricingCards />
        </Suspense>
      </div>

      <p className="mx-auto mt-12 max-w-xl text-center text-sm text-muted-foreground">
        🔒 Secured by Stripe · Test mode — no real charges
      </p>
    </div>
  )
}
