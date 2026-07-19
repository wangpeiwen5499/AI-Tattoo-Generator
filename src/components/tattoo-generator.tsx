'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CreditsBadge } from '@/components/credits-badge'
import { ImageUploader } from '@/components/image-uploader'
import { GenerationProgress } from '@/components/generation-progress'
import { GenerationResults } from '@/components/generation-results'
import { useCredits } from '@/hooks/use-credits'
import { useGeneration } from '@/hooks/use-generation'
import { CREDITS_PER_GENERATION } from '@/lib/constants'

/**
 * 纹身生成器主组件：上传 → 输入 → 生成 → 结果。
 * 持有状态机（来自 useGeneration）+ 余额（来自 useCredits）。
 */
export function TattooGenerator() {
  const credits = useCredits()
  const gen = useGeneration()

  // 错误 → toast（去重避免重复弹相同错误）
  const lastErrorRef = useRef<string | null>(null)
  useEffect(() => {
    if (!gen.error) return
    if (lastErrorRef.current === gen.error) return
    lastErrorRef.current = gen.error
    toast.error(gen.error)
  }, [gen.error])

  // 完成时刷新 credits（无论成功失败，因为可能扣过 / 退过）
  useEffect(() => {
    if (gen.status === 'completed' || gen.status === 'error') {
      credits.refresh()
    }
    // 故意不依赖 credits.refresh（避免 refresh 改变导致重复请求）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status])

  async function handleFile(file: File) {
    try {
      await gen.uploadPhoto(file)
      toast.success('Photo uploaded')
    } catch {
      // 错误已通过 gen.error → toast 展示
    }
  }

  async function handleGenerate() {
    if (credits.credits === null) {
      toast.error('Loading credits, please wait a moment')
      return
    }
    if (credits.credits < CREDITS_PER_GENERATION) {
      toast.error("You're out of credits. Pricing is coming soon.")
      return
    }
    try {
      await gen.generate()
    } catch {
      // 错误已通过 gen.error → toast 展示
    }
  }

  // generating 中：渲染进度
  if (gen.status === 'generating') {
    return (
      <div className="flex flex-col gap-4">
        <Header credits={credits.credits} creditsLoading={credits.loading} />
        <GenerationProgress
          progress={gen.generateProgress}
          stageLabel={gen.stageLabel}
          elapsedSeconds={gen.elapsedSeconds}
        />
      </div>
    )
  }

  // completed 或 error（有结果）：渲染结果
  if (gen.result && (gen.status === 'completed' || gen.status === 'error')) {
    return (
      <div className="flex flex-col gap-4">
        <Header credits={credits.credits} creditsLoading={credits.loading} />
        <GenerationResults
          tattooDesignUrl={gen.result.tattooDesignUrl}
          images={gen.result.images}
          refunded={gen.refunded}
          onRegenerate={gen.resetPhoto}
          onReset={gen.reset}
        />
      </div>
    )
  }

  // idle / uploading / ready：渲染表单
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
                onClear={gen.resetPhoto}
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
              <p className="text-xs text-muted-foreground">
                {gen.prompt.length}/500 characters
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Cost: <span className="font-medium text-foreground">{CREDITS_PER_GENERATION} credit</span> · 4 previews (left arm, right arm, shoulder, calf)
            </p>
            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!ready || !gen.prompt.trim() || gen.status === 'uploading'}
              className="sm:min-w-[180px]"
            >
              {gen.status === 'uploading' ? 'Uploading...' : 'Generate'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Header({
  credits,
  creditsLoading,
}: {
  credits: number | null
  creditsLoading: boolean
}) {
  return (
    <div className="flex justify-end">
      <CreditsBadge credits={credits} loading={creditsLoading} />
    </div>
  )
}
