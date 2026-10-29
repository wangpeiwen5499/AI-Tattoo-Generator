'use client';

import { useTranslations } from 'next-intl';

import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { emailVerificationUrl } from '@/shared/lib/auth-callback';

import { TattooCaseDemo } from './tattoo-case-demo';
import { TattooGenerator } from './tattoo-generator';

export function GenerationAccess() {
  const { data: session, isPending } = useSession();
  const t = useTranslations('common.funnel');
  if (isPending)
    return (
      <div role="status" className="py-32 text-center">
        {t('checkingAccount')}
      </div>
    );
  if (session?.user?.emailVerified) return <TattooGenerator />;
  if (session?.user)
    return (
      <section className="mx-auto max-w-xl px-5 py-32 text-center">
        <h2 className="text-2xl font-semibold">{t('verifyTitle')}</h2>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          {t('verifyDescription')}
        </p>
        <Button asChild className="mt-6">
          <Link href={emailVerificationUrl(session.user.email)}>
            {t('verifyEmail')}
          </Link>
        </Button>
        <p className="mt-5 text-sm">
          <Link href="/#tattoo-case" className="underline underline-offset-4">
            {t('exploreExample')}
          </Link>
        </p>
      </section>
    );
  return (
    <section className="px-4 pt-28 pb-12 sm:px-6">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <h2 className="text-2xl font-semibold sm:text-3xl">
          {t('guestTitle')}
        </h2>
        <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
          {t('guestDescription')}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild>
            <Link href="/sign-up?callbackUrl=%2Fgenerate">
              {t('getCredits')}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/sign-in?callbackUrl=%2Fgenerate">{t('signIn')}</Link>
          </Button>
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          {t('bonusExplanation')}
        </p>
      </div>
      <TattooCaseDemo />
    </section>
  );
}
