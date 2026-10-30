'use client';

import { Check, Loader2 } from 'lucide-react';

type Props = {
  progress: number;
  stageLabel: string;
  elapsedSeconds: number;
};

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function GenerationProgress({
  progress,
  stageLabel,
  elapsedSeconds,
}: Props) {
  const inStep1 = progress < 35;
  const inStep2 = progress >= 35 && progress < 95;
  const isFinalizing = !inStep1 && !inStep2;

  return (
    <div className="border-border/50 bg-card flex flex-col gap-4 rounded-lg border p-6">
      <div className="flex items-center gap-2">
        <Loader2 className="text-primary h-5 w-5 animate-spin" />
        <h3 className="text-base font-semibold">
          Generating your tattoo preview...
        </h3>
      </div>

      <div className="flex flex-col gap-2">
        <StepRow
          label="Step 1: Designing your tattoo"
          state={
            inStep1 ? 'active' : inStep2 || isFinalizing ? 'done' : 'pending'
          }
        />
        <StepRow
          label="Step 2: Placing on body (4 parts in parallel)"
          state={inStep2 ? 'active' : isFinalizing ? 'done' : 'pending'}
        />
        {isFinalizing && <StepRow label={stageLabel} state="active" />}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-muted-foreground flex items-center justify-between text-xs">
          <span>{Math.round(progress)}%</span>
          <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
        </div>
        <div
          className="bg-muted h-2 w-full overflow-hidden rounded-full"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-primary h-full transition-[width] duration-500 ease-out"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      <p className="text-muted-foreground text-xs">
        Timing depends on resolution and provider demand. You can leave and
        return from History.
      </p>
    </div>
  );
}

function StepRow({
  label,
  state,
}: {
  label: string;
  state: 'pending' | 'active' | 'done';
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {state === 'done' ? (
        <Check className="text-primary h-4 w-4" />
      ) : state === 'active' ? (
        <Loader2 className="text-primary h-4 w-4 animate-spin" />
      ) : (
        <span className="border-border h-4 w-4 rounded-full border" />
      )}
      <span
        className={
          state === 'pending' ? 'text-muted-foreground' : 'text-foreground'
        }
      >
        {label}
      </span>
    </div>
  );
}
