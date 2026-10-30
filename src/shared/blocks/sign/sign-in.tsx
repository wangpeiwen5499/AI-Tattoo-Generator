'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signIn } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  emailVerificationUrl,
  safeAuthCallback,
} from '@/shared/lib/auth-callback';

import { SocialProviders } from './social-providers';

export function SignIn({
  configs,
  callbackUrl = '/',
  socialError = false,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  socialError?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations('common.sign');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

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
    <Card className="mx-auto w-full md:max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-lg md:text-xl">
          <h1>{t('sign_in_title')}</h1>
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          <h2>{t('sign_in_description')}</h2>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {socialError && (
            <p
              role="alert"
              className="text-destructive text-sm leading-relaxed"
            >
              {t('social_failed')}
            </p>
          )}
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
                <div className="flex items-center">
                  <Label htmlFor="password">{t('password_title')}</Label>
                  <Link
                    href={`/forgot-password?callbackUrl=${encodeURIComponent(destination)}`}
                    className="ml-auto inline-block text-sm underline"
                  >
                    {t('forgot_password')}
                  </Link>
                </div>

                <Input
                  id="password"
                  type="password"
                  placeholder={t('password_placeholder')}
                  autoComplete="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
      </CardContent>
      {isEmailAuthEnabled && (
        <CardFooter>
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
        </CardFooter>
      )}
    </Card>
  );
}
