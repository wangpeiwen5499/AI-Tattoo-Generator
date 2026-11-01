'use client';

import { useId, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export function StudioPanel({
  step,
  title,
  summary,
  open,
  complete,
  disabled,
  onOpen,
  children,
}: {
  step: number;
  title: string;
  summary: string;
  open: boolean;
  complete: boolean;
  disabled: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="studio-accordion-item" data-open={open || undefined}>
      <h2>
        <button
          type="button"
          className="studio-accordion-trigger"
          aria-expanded={open}
          aria-controls={id}
          disabled={disabled}
          onClick={onOpen}
        >
          <span className="studio-accordion-number" aria-hidden="true">
            {complete && !open ? (
              <Check size={15} />
            ) : (
              String(step).padStart(2, '0')
            )}
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-medium">{title}</span>
            {!open && (
              <span className="text-muted-foreground block truncate text-xs">
                {summary}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={`size-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={id} hidden={!open} className="studio-accordion-panel">
        {children}
      </div>
    </section>
  );
}
