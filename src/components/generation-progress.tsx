'use client'

import { Check, Loader2 } from 'lucide-react'

type Props = {
  progress: number        // 0-100
  stageLabel: string
  elapsedSeconds: number
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

/**
* 生成进度展示：阶段标签 + 进度条 + 已耗时。
* 阶段标签由父组件传入（来自 useGeneration 的 stageLabel）。
*/
export function GenerationProgress({ progress, stageLabel, elapsedSeconds }: Props) {
  const inStep1 = stageLabel.startsWith('Step 1')
  const inStep2 = stageLabel.startsWith('Step 2')
  const isFinalizing = !inStep1 && !inStep2

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-card p-6">
      <div className="flex items-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <h3 className="text-base font-semibold">Generating your tattoo preview...</h3>
      </div>

      <div className="flex flex-col gap-2">
        <StepRow
          label="Step 1: Designing your tattoo"
          state={inStep1 ? 'active' : inStep2 || isFinalizing ? 'done' : 'pending'}
        />
        <StepRow
          label="Step 2: Placing on body (4 parts in parallel)"
          state={inStep2 ? 'active' : isFinalizing ? 'done' : 'pending'}
        />
        {isFinalizing && (
          <StepRow label={stageLabel} state="active" />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{Math.round(progress)}%</span>
          <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Usually takes 3–5 minutes · Keep this tab open.
      </p>
    </div>
  )
}

function StepRow({
  label,
  state,
}: {
  label: string
  state: 'pending' | 'active' | 'done'
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {state === 'done' ? (
        <Check className="h-4 w-4 text-primary" />
      ) : state === 'active' ? (
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      ) : (
        <span className="h-4 w-4 rounded-full border border-border" />
      )}
      <span className={state === 'pending' ? 'text-muted-foreground' : 'text-foreground'}>
        {label}
      </span>
    </div>
  )
}
