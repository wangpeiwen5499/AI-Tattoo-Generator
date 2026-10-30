'use client';

import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FcGoogle } from 'react-icons/fc';
import { RiGithubFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { Button } from '@/shared/components/ui/button';
import { safeAuthCallback } from '@/shared/lib/auth-callback';
import { cn } from '@/shared/lib/utils';
import { Button as ButtonType } from '@/shared/types/blocks/common';

export function SocialProviders({
  configs,
  callbackUrl,
  loading,
  setLoading,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}) {
  const t = useTranslations('common.sign');

  const locale = useLocale();
  const destination = safeAuthCallback(callbackUrl, locale);

  const handleSignIn = async ({ provider }: { provider: string }) => {
    setLoading(true);
    try {
      const result = await signIn.social({
        provider,
        callbackURL: destination,
        errorCallbackURL: safeAuthCallback(
          `/sign-in?callbackUrl=${encodeURIComponent(destination)}`,
          locale
        ),
      });
      if (result.error)
        throw new Error(result.error.message || t('social_failed'));
      // Keep the form mounted and busy until Better Auth navigates to Google.
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('social_failed'));
      setLoading(false);
    }
  };

  const providers: ButtonType[] = [];

  if (configs.google_auth_enabled === 'true') {
    providers.push({
      name: 'google',
      title: t('google_sign_in_title'),
      icon: <FcGoogle aria-hidden className="size-5" />,
      onClick: () => handleSignIn({ provider: 'google' }),
    });
  }

  if (configs.github_auth_enabled === 'true') {
    providers.push({
      name: 'github',
      title: t('github_sign_in_title'),
      icon: <RiGithubFill />,
      onClick: () => handleSignIn({ provider: 'github' }),
    });
  }

  if (providers.length === 0) return null;

  return (
    <div
      className={cn(
        'flex w-full items-center gap-2',
        'flex-col justify-between'
      )}
    >
      {providers.map((provider) => (
        <Button
          key={provider.name}
          variant="outline"
          className={cn(
            'h-11 w-full gap-2 rounded-[10px]',
            provider.name === 'google' &&
              'relative border-gray-200 bg-white text-base font-medium text-gray-900 shadow-sm hover:bg-gray-100 hover:text-gray-900 hover:shadow-md dark:border-gray-200 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
          )}
          disabled={loading}
          onClick={provider.onClick}
        >
          <span className={provider.name === 'google' ? 'absolute left-4' : ''}>
            {loading ? (
              <Loader2 aria-hidden className="size-5 animate-spin" />
            ) : (
              provider.icon
            )}
          </span>
          <span>{provider.title}</span>
        </Button>
      ))}
    </div>
  );
}
