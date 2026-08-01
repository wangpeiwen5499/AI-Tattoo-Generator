import { Suspense } from 'react'
import Link from 'next/link'
import { SignInButton, Show } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { TattooGenerator } from '@/components/tattoo-generator'
import { PaymentFeedback } from '@/components/payment-feedback'
import { Showcase } from '@/components/showcase'
import { HowItWorks } from '@/components/how-it-works'
import { PricingCards } from '@/components/pricing-cards'
import { Faq } from '@/components/faq'
import { SHOWCASE_EXAMPLES } from '@/lib/showcase-examples'

// showcaseImages 直接用数据文件里的 url（临时占位图；换真实图时恢复 getPublicUrl）
const showcaseImages = SHOWCASE_EXAMPLES

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
      <Suspense fallback={null}>
        <PaymentFeedback />
      </Suspense>

      <section className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          See Your Tattoo Before You Ink
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">
          Upload a photo, describe your idea, and let AI preview the tattoo on
          your arm, shoulder, and calf.
        </p>

        <p className="mt-5 text-sm text-muted-foreground">
          Pricing starts at <span className="font-medium text-foreground">$4.99</span> for 5 previews ·{' '}
          <Link href="/pricing" className="underline underline-offset-4 transition-colors hover:text-foreground">
            See full pricing
          </Link>
        </p>

        <Show when="signed-out">
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button size="lg">Try it free</Button>
            </SignInButton>
            <Button size="lg" variant="outline" render={<Link href="#examples" />}>
              See examples
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            1 free generation on sign up · No credit card required
          </p>
        </Show>
      </section>

      <Show when="signed-out">
        <Showcase images={showcaseImages} />
        <HowItWorks />

        <section className="mt-24">
          <div className="mx-auto max-w-5xl px-4">
            <h2 className="text-center text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Pick a package
            </h2>
            <p className="mx-auto mt-3 max-w-md text-center text-base text-muted-foreground text-pretty">
              One-time payment · No subscription · Credits never expire
            </p>
            <div className="mt-12">
              <Suspense fallback={null}>
                <PricingCards />
              </Suspense>
            </div>
            <p className="mt-8 text-center text-xs text-muted-foreground">
              🔒 Secured by Creem · Test mode — no real charges
            </p>
          </div>
        </section>

        <Faq />
      </Show>

      <Show when="signed-in">
        <div className="mt-10">
          <TattooGenerator />
        </div>
      </Show>
    </div>
  )
}
