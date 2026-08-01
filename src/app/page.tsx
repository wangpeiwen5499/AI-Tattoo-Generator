import { Suspense } from 'react'
import Link from 'next/link'
import { SignInButton, Show } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { TattooGenerator } from '@/components/tattoo-generator'
import { PaymentFeedback } from '@/components/payment-feedback'
import { Showcase } from '@/components/showcase'
import { SHOWCASE_EXAMPLES } from '@/lib/showcase-examples'
import { getPublicUrl } from '@/lib/r2'

// Server 端解析示例图 URL（getPublicUrl 用 process.env.R2_PUBLIC_URL，
// 且 lib/r2.ts import 了 @aws-sdk/client-s3，不能进 Client bundle）
const showcaseImages = SHOWCASE_EXAMPLES.map((ex) => ({
  url: getPublicUrl(ex.key),
  alt: ex.alt,
}))

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
      </Show>

      <Show when="signed-in">
        <div className="mt-10">
          <TattooGenerator />
        </div>
      </Show>
    </div>
  )
}
