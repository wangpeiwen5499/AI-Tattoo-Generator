'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useAppContext } from '@/shared/contexts/app';
import {
  emailVerificationUrl,
  safeAuthCallback,
} from '@/shared/lib/auth-callback';

import { SocialProviders } from './social-providers';

export function SignInForm({
  callbackUrl = '/',
  className,
}: {
  callbackUrl: string;
  className?: string;
}) {
  const t = useTranslations('common.sign');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const { configs, setIsShowSignModal } = useAppContext();

  const isGoogleAuthEnabled = configs.google_auth_enabled === 'true';
  const isGithubAuthEnabled = configs.github_auth_enabled === 'true';
  const hasSocial = isGoogleAuthEnabled || isGithubAuthEnabled;
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' ||
    (!isGoogleAuthEnabled && !isGithubAuthEnabled); // no social providers enabled, auto enable email auth

  const locale = useLocale();
  const destination = safeAuthCallback(callbackUrl, locale);

  const handleSignIn = async () => {
    if (loading) {
      return;
    }

    if (!email || !password) {
      toast.error('email and password are required');
      return;
    }

    try {
      setLoading(true);
      await signIn.email(
        {
          email,
          password,
        },
        {
          onRequest: () => {
            setLoading(true);
          },
          onResponse: (ctx: any) => {
            setLoading(false);
            if (!ctx?.response?.ok) {
              // 凭证错误等：onError 在某些场景不触发，这里兜底显示后端错误
              ctx?.response
                ?.clone()
                .json()
                .then((body: any) => {
                  toast.error(
                    body?.message || body?.error?.message || 'sign in failed',
                    {
                      id: 'sign-in-error',
                    }
                  );
                })
                .catch(() =>
                  toast.error('sign in failed', { id: 'sign-in-error' })
                );
            }
          },
          onSuccess: (ctx: any) => {
            setIsShowSignModal(false);
            router.push(
              ctx.data?.user?.emailVerified
                ? destination
                : safeAuthCallback(
                    emailVerificationUrl(email, destination),
                    locale
                  )
            );
            router.refresh();
            toast.success('Welcome back!', {
              description: 'You have signed in successfully.',
            });
          },
          onError: (ctx: any) => {
            toast.error(ctx?.error?.message || 'sign in failed', {
              id: 'sign-in-error',
            });
            setLoading(false);
          },
        }
      );
    } catch (e: any) {
      toast.error(e.message || 'sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full md:max-w-md ${className}`}>
      <div className="grid gap-4">
        <SocialProviders
          configs={configs}
          callbackUrl={destination}
          loading={loading}
          setLoading={setLoading}
        />
        {hasSocial && isEmailAuthEnabled && (
          <>
            <div
              role="separator"
              aria-label={t('or')}
              className="text-muted-foreground flex items-center gap-4 py-1 text-xs"
            >
              <span className="bg-border h-px flex-1" />
              <span>{t('or')}</span>
              <span className="bg-border h-px flex-1" />
            </div>
            {!showEmail && (
              <Button
                variant="ghost"
                className="text-muted-foreground h-10 w-full font-normal"
                onClick={() => setShowEmail(true)}
              >
                {t('continue_email')}
              </Button>
            )}
          </>
        )}
        {isEmailAuthEnabled && (!hasSocial || showEmail) && (
          <>
            <div className="grid gap-2">
              <Label htmlFor="email">{t('email_title')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('email_placeholder')}
                required
                onChange={(e) => {
                  setEmail(e.target.value);
                }}
                value={email}
              />
            </div>

            <div className="grid gap-2">
              {/* <div className="flex items-center">
              <Label htmlFor="password">{t("password_title")}</Label>
              <Link href="#" className="ml-auto inline-block text-sm underline">
                Forgot your password?
              </Link>
            </div> */}

              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="password">{t('password_title')}</Label>
                <Link
                  href={`/forgot-password?callbackUrl=${encodeURIComponent(destination)}`}
                  className="text-sm underline"
                  onClick={() => setIsShowSignModal(false)}
                >
                  {t('forgot_password')}
                </Link>
              </div>

              <Input
                id="password"
                type="password"
                placeholder={t('password_placeholder')}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              onClick={handleSignIn}
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <p> {t('sign_in_title')} </p>
              )}
            </Button>
          </>
        )}
      </div>
      {isEmailAuthEnabled && (
        <div className="flex w-full justify-center border-t py-4">
          <p className="text-center text-xs text-neutral-500">
            {t('no_account')}{' '}
            <Link
              href={`/sign-up?callbackUrl=${encodeURIComponent(destination)}`}
              className="underline"
            >
              <span className="cursor-pointer dark:text-white/70">
                {t('sign_up_title')}
              </span>
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
