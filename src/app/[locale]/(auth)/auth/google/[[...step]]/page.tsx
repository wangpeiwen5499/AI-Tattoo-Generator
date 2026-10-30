import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { getClerkNativeConfig } from '@/core/auth/clerk';
import { Link } from '@/core/i18n/navigation';
import { ClerkGoogleFlow } from '@/shared/blocks/sign/clerk-google-flow';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata({
  title: 'Google sign in — TattooVis',
  noIndex: true,
});

export default async function GoogleSignInPage({
  params,
  searchParams,
}: {
  params: Promise<{ step?: string[] }>;
  searchParams: Promise<{ callbackUrl?: string; mode?: string }>;
}) {
  const [{ step }, { callbackUrl, mode }] = await Promise.all([
    params,
    searchParams,
  ]);
  const stage = step?.[0] || 'start';
  if (
    (step?.length || 0) > 1 ||
    !['start', 'callback', 'complete', 'continue', 'tasks'].includes(stage)
  )
    notFound();
  const config = getClerkNativeConfig();
  if (!config) {
    const t = await getTranslations('common.sign');
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p role="alert">{t('social_failed')}</p>
        <Link href="/sign-in" className="underline">
          {t('back_to_sign_in')}
        </Link>
      </div>
    );
  }
  return (
    <ClerkGoogleFlow
      publishableKey={config.publishableKey}
      step={stage}
      callbackUrl={callbackUrl}
      signup={mode === 'signup'}
    />
  );
}
