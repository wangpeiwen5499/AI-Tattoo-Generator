'use client';

import { useId } from 'react';
import {
  TATTOO_RESOLUTIONS,
  tattooResolutionPolicy,
  type TattooResolution,
} from '@/lib/tattoo-resolution';
import { useTranslations } from 'next-intl';

import { cn } from '@/shared/lib/utils';

export function ResolutionPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: TattooResolution;
  onChange: (value: TattooResolution) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('common.funnel');
  const name = useId();
  return (
    <fieldset disabled={disabled} className="mt-6">
      <legend className="text-sm font-semibold">{t('resolutionLabel')}</legend>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
        {TATTOO_RESOLUTIONS.map((resolution) => (
          <label
            key={resolution}
            className={cn(
              'has-[:focus-visible]:ring-primary cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2',
              value === resolution
                ? 'border-primary bg-primary/5'
                : 'border-border/60 hover:bg-muted/50',
              disabled && 'cursor-wait opacity-60'
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-base font-semibold">{resolution}</span>
              <input
                type="radio"
                name={name}
                value={resolution}
                checked={value === resolution}
                onChange={() => onChange(resolution)}
                className="accent-primary size-4"
                aria-label={t('resolutionOption', {
                  resolution,
                  count: tattooResolutionPolicy(resolution).credits,
                })}
              />
            </span>
            <span className="text-muted-foreground mt-1 block text-xs">
              {t(`resolution${resolution}`)}
            </span>
            <span className="mt-2 block text-sm font-medium">
              {t('creditCost', {
                count: tattooResolutionPolicy(resolution).credits,
              })}
            </span>
          </label>
        ))}
      </div>
      <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
        {t('resolutionHelp')}
      </p>
    </fieldset>
  );
}
