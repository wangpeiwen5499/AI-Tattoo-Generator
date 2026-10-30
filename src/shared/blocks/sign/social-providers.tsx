'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { FcGoogle } from 'react-icons/fc';
import { RiGithubFill } from 'react-icons/ri';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { Button } from '@/shared/components/ui/button';
import { useAppContext } from '@/shared/contexts/app';
import { safeAuthCallback } from '@/shared/lib/auth-callback';
import { cn } from '@/shared/lib/utils';
import { Button as ButtonType } from '@/shared/types/blocks/common';

const NativeGoogleController = dynamic(
  () =>
    import('./clerk-google-controller').then(
      (module) => module.NativeGoogleController
    ),
  { ssr: false }
);

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
  const router = useRouter();
  const [nativeRequested, setNativeRequested] = useState(false);
  const publishableKey = configs.clerk_publishable_key;

  const { setIsShowSignModal } = useAppContext();

  const locale = useLocale();
  const destination = safeAuthCallback(callbackUrl, locale);

  const handleSignIn = async ({ provider }: { provider: string }) => {
    if (provider === 'clerk') {
      if (publishableKey) {
        setLoading(true);
        setNativeRequested(true);
        return;
      }
      setIsShowSignModal(false);
      router.push(
        safeAuthCallback(
          `/auth/google?callbackUrl=${encodeURIComponent(destination)}`,
          locale
        )
      );
      return;
    }
    await signIn.social(
      {
        provider: provider,
        callbackURL: destination,
      },
      {
        onRequest: (ctx) => {
          setLoading(true);
        },
        onResponse: (ctx) => {
          setLoading(false);
          setIsShowSignModal(false);
        },
        onSuccess: (ctx) => {},
        onError: (e: any) => {
          toast.error(e?.error?.message || 'sign in failed');
          setLoading(false);
        },
      }
    );
  };

  const providers: ButtonType[] = [];

  if (
    configs.clerk_google_auth_enabled === 'true' ||
    configs.google_auth_enabled === 'true'
  ) {
    providers.push({
      name: 'google',
      title: t('google_sign_in_title'),
      icon: <FcGoogle aria-hidden className="size-5" />,
      onClick: () =>
        handleSignIn({
          provider:
            configs.clerk_google_auth_enabled === 'true' ? 'clerk' : 'google',
        }),
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
      {configs.clerk_google_auth_enabled === 'true' && publishableKey && (
        <NativeGoogleController
          publishableKey={publishableKey}
          requested={nativeRequested}
          destination={destination}
          locale={locale}
          onFailure={() => {
            setNativeRequested(false);
            setLoading(false);
            toast.error(t('social_failed'));
          }}
        />
      )}
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
            {provider.name === 'google' && nativeRequested && loading ? (
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
