'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/core/auth/client'
import { toast } from 'sonner'
import { Sparkles, Upload, Zap, ArrowRight } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent } from '@/shared/components/ui/card'
import { CreditsBadge } from '@/shared/blocks/tattoo/credits-badge'
import { ImageUploader } from '@/shared/blocks/tattoo/image-uploader'
import { GenerationProgress } from '@/shared/blocks/tattoo/generation-progress'
import { GenerationResults } from '@/shared/blocks/tattoo/generation-results'
import { useCredits } from '@/hooks/use-credits'
import { useGeneration } from '@/hooks/use-generation'
import { CREDITS_PER_GENERATION } from '@/lib/constants'

export function TattooGenerator() {
  const router = useRouter()
  const credits = useCredits()
  const gen = useGeneration()
  const { data: session, isPending: sessionLoading } = useSession()
  const isSignedIn = !!session?.user && !sessionLoading

  const lastErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gen.error) return
    if (lastErrorRef.current === gen.error) return
    lastErrorRef.current = gen.error
    toast.error(gen.error)
  }, [gen.error])

  useEffect(() => {
    if (gen.status === 'completed' || gen.status === 'error') {
      credits.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status])

  useEffect(() => {
    const retryTimer = { current: 0 as number }
    const handleRefresh = () => {
      credits.refresh()
      window.clearTimeout(retryTimer.current)
      retryTimer.current = window.setTimeout(() => credits.refresh(), 2500)
    }
    window.addEventListener('credits:refresh', handleRefresh)
    return () => {
      window.removeEventListener('credits:refresh', handleRefresh)
      window.clearTimeout(retryTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleFile(file: File) {
    try {
      await gen.uploadPhoto(file)
      toast.success('Photo uploaded')
    } catch {
      // error shown via gen.error → toast
    }
  }

  async function handleGenerate() {
    if (credits.credits === null) {
      toast.error('Loading credits, please wait a moment')
      return
    }
    if (credits.credits < CREDITS_PER_GENERATION) {
      if (isSignedIn) {
        toast.error("You're out of credits", {
          description: 'Buy credits to keep generating',
          action: { label: 'Buy Credits', onClick: () => router.push('/pricing') },
        })
      } else {
        toast.error("You've used your free preview", {
          description: 'Sign up to get 3 more previews',
          action: { label: 'Sign up', onClick: () => router.push('/sign-in') },
        })
      }
      return
    }
    try {
      await gen.generate()
    } catch {
      // error shown via gen.error → toast
    }
  }

  const isGuestOutOfCredits = !isSignedIn && credits.credits !== null && credits.credits < CREDITS_PER_GENERATION

  // generating → render progress
  if (gen.status === 'generating') {
    return (
      <section className="py-24 md:py-36">
        <div className="container">
          <div className="flex items-center justify-end">
            <CreditsBadge credits={credits.credits} loading={credits.loading} />
          </div>
          <GenerationProgress
            progress={gen.generateProgress}
            stageLabel={gen.stageLabel}
            elapsedSeconds={gen.elapsedSeconds}
          />
        </div>
      </section>
    )
  }

  // completed/error with result → render results
  if (gen.result && (gen.status === 'completed' || gen.status === 'error')) {
    return (
      <section className="py-24 md:py-36">
        <div className="container">
          <div className="flex items-center justify-end">
            <CreditsBadge credits={credits.credits} loading={credits.loading} />
          </div>
          <GenerationResults
            tattooDesignUrl={gen.result.tattooDesignUrl}
            images={gen.result.images}
            refunded={gen.refunded}
            onRegenerate={gen.resetPrompt}
            onReset={gen.reset}
          />
        </div>
      </section>
    )
  }

  // idle / uploading / ready → render form
  const ready = gen.status === 'ready' || (gen.status === 'uploading' && gen.photoUrl !== null)

  return (
    <section className="py-24 md:py-36">
      {/* --- Section header --- */}
      <div className="mx-auto mb-12 px-4 text-center md:px-8">
        <h2 className="mb-6 text-3xl font-bold text-pretty lg:text-4xl">
          AI Tattoo Generator
        </h2>
        <p className="text-muted-foreground mx-auto max-w-xl lg:max-w-none lg:text-lg">
          Upload your photo, describe your idea, and see how your tattoo will
          look before you commit. AI generates 4 realistic previews on
          different body parts.
        </p>
      </div>

      <div className="container">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="flex items-center justify-end">
            <CreditsBadge credits={credits.credits} loading={credits.loading} />
          </div>

          {/* --- Step 1: Upload Photo --- */}
          <Card className="overflow-hidden border-border/40 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 border-b border-border/40 px-6 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  1
                </span>
                <div>
                  <h3 className="text-base font-semibold">Upload your photo</h3>
                  <p className="text-xs text-muted-foreground">
                    Take a clear photo of the body part you want tattooed
                  </p>
                </div>
              </div>
              <div className="p-6">
                <ImageUploader
                  photoUrl={gen.photoUrl}
                  uploading={gen.status === 'uploading'}
                  uploadProgress={gen.uploadProgress}
                  onFileSelected={handleFile}
                  onClear={gen.clearPhoto}
                />
              </div>
            </CardContent>
          </Card>

          {/* --- Step 2: Describe your idea --- */}
          <Card className="overflow-hidden border-border/40 shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center gap-3 border-b border-border/40 px-6 py-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  2
                </span>
                <div>
                  <h3 className="text-base font-semibold">
                    Describe your tattoo idea
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Be specific — mention style, colors, size, and reference
                    elements
                  </p>
                </div>
              </div>
              <div className="p-6">
                <Textarea
                  value={gen.prompt}
                  onChange={(e) => gen.setPrompt(e.target.value)}
                  placeholder="e.g. A dragon wrapped around my forearm in Japanese irezumi style, bold black lines with crimson red accents, detailed scales, half-sleeve size"
                  rows={4}
                  maxLength={500}
                  className="resize-none text-base leading-relaxed"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {gen.prompt.length}/500 characters
                  </p>
                  {gen.prompt.trim() && (
                    <span className="text-xs text-primary/70">
                      ✓ Well described
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* --- Action bar --- */}
          <div className="flex flex-col gap-4 rounded-xl border border-border/40 bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {CREDITS_PER_GENERATION} credit{' · '}
                  {isSignedIn ? (
                    <span className="text-muted-foreground">
                      {credits.credits !== null
                        ? `${credits.credits} available`
                        : 'Loading...'}
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Free preview
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  4 previews — left arm, right arm, shoulder &amp; calf
                </p>
              </div>
            </div>
            <Button
              size="lg"
              onClick={
                isGuestOutOfCredits
                  ? () => router.push('/sign-in')
                  : handleGenerate
              }
              disabled={
                !isGuestOutOfCredits &&
                (!ready || !gen.prompt.trim() || gen.status === 'uploading')
              }
              className="group h-12 gap-2 px-6 text-base font-semibold shadow-md transition-all hover:shadow-lg"
            >
              {isGuestOutOfCredits ? (
                'Sign up for 3 more'
              ) : gen.status === 'uploading' ? (
                <>
                  <Upload className="h-4 w-4 animate-pulse" />
                  Uploading...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
                  Generate My Tattoo Preview
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
