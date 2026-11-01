'use client';

import { useId, type ReactNode } from 'react';
import { Check, Info, X } from 'lucide-react';
import { Popover } from 'radix-ui';

export function studioTaskKind({
  busy,
  phase,
  action,
  task,
  pending,
}: {
  busy: boolean;
  phase: string;
  action?: 'design' | 'render';
  task?: 'design' | 'render';
  pending?: 'design' | 'render';
}) {
  if (!busy) return undefined;
  if ((phase === 'uploading' || phase === 'submitting') && action)
    return action;
  return task || pending || action;
}

export function studioStep({
  photo,
  design,
  result,
  showResult,
  task,
}: {
  photo: boolean;
  design: boolean;
  result: boolean;
  showResult: boolean;
  task?: 'design' | 'render';
}) {
  if (task === 'render') return 4;
  if (task === 'design') return 2;
  if (!photo) return 1;
  if (!design) return 2;
  return result && showResult ? 4 : 3;
}

export function StudioSteps({
  locale,
  current,
  completed,
  onSelect,
  busy = false,
}: {
  locale: string;
  current: number;
  completed: boolean[];
  onSelect: (step: number) => void;
  busy?: boolean;
}) {
  const labels =
    locale === 'zh'
      ? ['选择照片', '选择图案', '确认摆放', '真实结果']
      : ['Choose photo', 'Choose design', 'Confirm placement', 'Real result'];
  return (
    <nav
      aria-label={locale === 'zh' ? '纹身试戴步骤' : 'Tattoo try-on steps'}
      className="studio-progress"
    >
      <ol>
        {labels.map((label, index) => {
          const step = index + 1,
            active = current === step,
            done = completed[index];
          return (
            <li
              key={step}
              aria-current={active ? 'step' : undefined}
              data-complete={done || undefined}
            >
              <button
                type="button"
                disabled={
                  busy || (!done && !active && step !== 1 && step !== 2)
                }
                onClick={() => onSelect(step)}
              >
                <span aria-hidden="true" className="studio-step-marker">
                  {done && !active ? (
                    <Check size={16} />
                  ) : (
                    String(step).padStart(2, '0')
                  )}
                </span>
                <span>{label}</span>
                {active && busy && (
                  <span className="sr-only">
                    {locale === 'zh' ? '处理中' : 'Working'}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepHelp({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="studio-help-trigger"
        >
          <Info size={17} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          aria-label={label}
          sideOffset={8}
          collisionPadding={16}
          className="studio-help-content"
        >
          <div className="mb-2 flex items-center justify-between gap-4">
            <strong className="text-sm font-medium">{label}</strong>
            <Popover.Close
              aria-label={`Close ${label}`}
              className="hover:bg-muted rounded p-2"
            >
              <X size={16} />
            </Popover.Close>
          </div>
          <div className="text-muted-foreground text-sm leading-7">
            {children}
          </div>
          <Popover.Arrow className="fill-border" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function StepHint({
  children,
  onDismiss,
  locale,
  id,
}: {
  children: ReactNode;
  onDismiss: () => void;
  locale: string;
  id?: string;
}) {
  const generated = useId();
  return (
    <div id={id || generated} role="status" className="studio-step-hint">
      <p>{children}</p>
      <button
        type="button"
        aria-label={locale === 'zh' ? '关闭提示' : 'Dismiss tip'}
        onClick={onDismiss}
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}
