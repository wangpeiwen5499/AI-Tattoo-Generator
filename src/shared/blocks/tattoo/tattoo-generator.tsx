'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/core/auth/client'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
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

  // 错误 → toast
  const lastErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gen.error) return
    if (lastErrorRef.current === gen.error) return
    lastErrorRef.current = gen.error
    toast.error(gen.error)
  }, [gen.error])

  // 完成时刷新 credits
  useEffect(() => {
    if (gen.status === 'completed' || gen.status === 'error') {
      credits.refresh()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status])

  // 付款成功后刷新余额
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
      <div className="flex flex-col gap-4">
        <Header credits={credits.credits} creditsLoading={credits.loading} />
        <GenerationProgress progress={gen.generateProgress} stageLabel={gen.stageLabel} elapsedSeconds={gen.elapsedSeconds} />
      </div>
    )
  }

  // completed/error with result → render results
  if (gen.result && (gen.status === 'completed' || gen.status === 'error')) {
    return (
      <div className="flex flex-col gap-4">
        <Header credits={credits.credits} creditsLoading={credits.loading} />
        <GenerationResults
          tattooDesignUrl={gen.result.tattooDesignUrl}
          images={gen.result.images}
          refunded={gen.refunded}
          onRegenerate={gen.resetPrompt}
          onReset={gen.reset}
        />
      </div>
    )
  }

  // idle / uploading / ready → render form
  const ready = gen.status === 'ready' || (gen.status === 'uploading' && gen.photoUrl !== null)
  return (
    <div className="flex flex-col gap-4">
      <Header credits={credits.credits} creditsLoading={credits.loading} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Generate your tattoo preview
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">1. Upload your photo</label>
              <ImageUploader
                photoUrl={gen.photoUrl}
                uploading={gen.status === 'uploading'}
                uploadProgress={gen.uploadProgress}
                onFileSelected={handleFile}
                onClear={gen.clearPhoto}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">2. Describe your tattoo idea</label>
              <Textarea
                value={gen.prompt}
                onChange={(e) => gen.setPrompt(e.target.value)}
                placeholder="e.g. A dragon in Japanese irezumi style, bold black lines with red accents"
                rows={6}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">{gen.prompt.length}/500 characters</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Cost: <span className="font-medium text-foreground">{CREDITS_PER_GENERATION} credit</span> · 4 previews (left arm, right arm, shoulder, calf)
            </p>
            <Button
              size="lg"
              onClick={isGuestOutOfCredits ? () => router.push('/sign-in') : handleGenerate}
              disabled={!isGuestOutOfCredits && (!ready || !gen.prompt.trim() || gen.status === 'uploading')}
              className="sm:min-w-[180px]"
            >
              {isGuestOutOfCredits ? 'Sign up for 3 more' : gen.status === 'uploading' ? 'Uploading...' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Header({ credits, creditsLoading }: { credits: number | null; creditsLoading: boolean }) {
  return (
    <div className="flex justify-end">
      <CreditsBadge credits={credits} loading={creditsLoading} />
    </div>
  )
}
