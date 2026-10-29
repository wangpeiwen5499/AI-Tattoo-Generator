'use client';

import { useTranslations } from 'next-intl';

import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';

export function TrialCta({
  asButton = false,
  className,
}: {
  asButton?: boolean;
  className?: string;
}) {
  const { data } = useSession();
  const t = useTranslations('common.funnel');
  const link = (
    <Link
      href={data?.user ? '/generate' : '/sign-up?callbackUrl=%2Fgenerate'}
      className={asButton ? undefined : className}
    >
      {data?.user ? t('createOwn') : t('getCredits')}
    </Link>
  );
  return asButton ? (
    <Button asChild className={className}>
      {link}
    </Button>
  ) : (
    link
  );
}
