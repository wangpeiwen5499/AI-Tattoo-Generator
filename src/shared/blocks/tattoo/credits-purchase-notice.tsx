'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';

export function CreditsPurchaseNotice() {
  const t = useTranslations('common.funnel');
  return (
    <aside
      className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5"
      aria-label={t('noCreditsTitle')}
    >
      <h3 className="text-base font-semibold">{t('noCreditsTitle')}</h3>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {t('noCreditsDescription')}
      </p>
      <Button asChild className="mt-4">
        <Link href="/pricing">{t('buyCredits')}</Link>
      </Button>
    </aside>
  );
}
