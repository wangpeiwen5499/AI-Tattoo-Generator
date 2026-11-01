'use client';

import { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { signIn, signUp } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  emailVerificationUrl,
  safeAuthCallback,
} from '@/shared/lib/auth-callback';
import { cn } from '@/shared/lib/utils';

import { SocialProviders } from './social-providers';

type AuthMode = 'sign-in' | 'sign-up';
export function AuthFlow({
  configs,
  callbackUrl = '/',
  initialMode = 'sign-in',
  socialError = false,
  onAuthenticated,
  className,
}: {
  configs: Record<string, string>;
  callbackUrl?: string;
  initialMode?: AuthMode;
  socialError?: boolean;
  onAuthenticated?: () => void;
  className?: string;
}) {
  const t = useTranslations('common.sign');
  const funnel = useTranslations('common.funnel');
  const router = useRouter();
  const locale = useLocale();
  const destination = safeAuthCallback(callbackUrl, locale);
  const id = useId();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const hasSocial =
    configs.google_auth_enabled === 'true' ||
    configs.github_auth_enabled === 'true';
  const isEmailAuthEnabled =
    configs.email_auth_enabled !== 'false' || !hasSocial;
  const emailView = isEmailAuthEnabled && (!hasSocial || showEmail);
  const isSignup = mode === 'sign-up';
  const changeMode = (next: AuthMode) => {
    setMode(next);
    setPassword('');
    setConfirmPassword('');
  };
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
            onAuthenticated?.();
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

  const reportAffiliate = ({
    userEmail,
    stripeCustomerId,
  }: {
    userEmail: string;
    stripeCustomerId?: string;
  }) => {
    if (typeof window === 'undefined' || !configs) {
      return;
    }

    const windowObject = window as any;

    if (configs.affonso_enabled === 'true' && windowObject.Affonso) {
      windowObject.Affonso.signup(userEmail);
    }

    if (configs.promotekit_enabled === 'true' && windowObject.promotekit) {
      windowObject.promotekit.refer(userEmail, stripeCustomerId);
    }
  };

  const handleSignUp = async () => {
    if (loading) {
      return;
    }

    if (!email || !password || !name) {
      toast.error('email, password and name are required');
      return;
    }

    if (password.length < 8 || password.length > 128) {
      toast.error(t('password_length'));
      return;
    }
    if (password !== confirmPassword) {
      toast.error(t('password_mismatch'));
      return;
    }

    setLoading(true);
    try {
      await signUp.email(
        {
          email,
          password,
          name,
        },
        {
          onRequest: (ctx) => {
            setLoading(true);
          },
          onResponse: (ctx) => {
            setLoading(false);
          },
          onSuccess: (ctx) => {
            onAuthenticated?.();
            // report affiliate
            reportAffiliate({ userEmail: email });
            toast.success(funnel('signupSuccess'));
            router.push(
              safeAuthCallback(
                emailVerificationUrl(email, destination, true),
                locale
              )
            );
          },
          onError: (e: any) => {
            toast.error(e?.error?.message || 'sign up failed');
            setLoading(false);
          },
        }
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('signup_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('w-full', className)}>
      {!emailView && (
        <header className="mb-7 text-center">
          <p className="text-primary mb-5 text-xl font-semibold tracking-tight">
            TattooVis
          </p>
          <h1 className="text-foreground text-3xl leading-tight font-medium tracking-tight">
            {t('welcome_title')}
          </h1>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xs text-sm leading-relaxed">
            {t('welcome_description')}
          </p>
        </header>
      )}
      {emailView && (
        <h1 className="sr-only">
          {t(isSignup ? 'sign_up_title' : 'sign_in_title')}
        </h1>
      )}
      {socialError && (
        <p
          role="alert"
          className="text-destructive mb-4 text-sm leading-relaxed"
        >
          {t('social_failed')}
        </p>
      )}
      {!emailView && (
        <div className="grid gap-4">
          <SocialProviders
            configs={configs}
            callbackUrl={destination}
            loading={loading}
            setLoading={setLoading}
          />
          {isEmailAuthEnabled && (
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
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full"
                disabled={loading}
                onClick={() => setShowEmail(true)}
              >
                <Mail aria-hidden className="size-4" />
                {t('continue_email')}
              </Button>
            </>
          )}
        </div>
      )}
      {emailView && (
        <div>
          {hasSocial && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground mb-4 h-9 gap-2 px-0 hover:bg-transparent"
              disabled={loading}
              onClick={() => setShowEmail(false)}
            >
              <ArrowLeft aria-hidden className="size-4" />
              {t('back')}
            </Button>
          )}
          <div
            role="tablist"
            aria-label={t('email_sign_in')}
            className="bg-muted mb-6 grid grid-cols-2 rounded-full p-1"
          >
            {(['sign-in', 'sign-up'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`${id}-${tab}`}
                aria-controls={`${id}-panel`}
                aria-selected={mode === tab}
                tabIndex={mode === tab ? 0 : -1}
                disabled={loading}
                className={cn(
                  'focus-visible:ring-ring rounded-full px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50',
                  mode === tab
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground'
                )}
                onClick={() => changeMode(tab)}
                onKeyDown={(event) => {
                  if (
                    ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                      event.key
                    )
                  ) {
                    event.preventDefault();
                    const next =
                      event.key === 'Home'
                        ? 'sign-in'
                        : event.key === 'End'
                          ? 'sign-up'
                          : mode === 'sign-in'
                            ? 'sign-up'
                            : 'sign-in';
                    changeMode(next);
                    document.getElementById(`${id}-${next}`)?.focus();
                  }
                }}
              >
                {t(tab === 'sign-in' ? 'sign_in_title' : 'sign_up_title')}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${id}-panel`}
            aria-labelledby={`${id}-${mode}`}
          >
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void (isSignup ? handleSignUp() : handleSignIn());
              }}
            >
              {isSignup && (
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-name`}>{t('name_title')}</Label>
                  <Input
                    id={`${id}-name`}
                    name="name"
                    autoComplete="name"
                    placeholder={t('name_placeholder')}
                    required
                    disabled={loading}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor={`${id}-email`}>{t('email_title')}</Label>
                <Input
                  id={`${id}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder={t('email_placeholder')}
                  required
                  disabled={loading}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor={`${id}-password`}>
                    {t('password_title')}
                  </Label>
                  {!isSignup && (
                    <Link
                      href={`/forgot-password?callbackUrl=${encodeURIComponent(destination)}`}
                      onClick={onAuthenticated}
                      className="text-muted-foreground text-xs underline underline-offset-4"
                    >
                      {t('forgot_password')}
                    </Link>
                  )}
                </div>
                <Input
                  id={`${id}-password`}
                  name="password"
                  type="password"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  minLength={isSignup ? 8 : undefined}
                  maxLength={isSignup ? 128 : undefined}
                  placeholder={t('password_placeholder')}
                  required
                  disabled={loading}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
              {isSignup && (
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-confirm`}>
                    {t('confirm_password')}
                  </Label>
                  <Input
                    id={`${id}-confirm`}
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    placeholder={t('confirm_password_placeholder')}
                    required
                    disabled={loading}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    aria-invalid={
                      confirmPassword.length > 0 && password !== confirmPassword
                    }
                    className="h-11 rounded-xl"
                  />
                </div>
              )}
              <Button
                type="submit"
                className="mt-2 h-11 w-full rounded-full"
                disabled={loading}
                aria-busy={loading}
              >
                {loading && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                {t(isSignup ? 'sign_up_title' : 'sign_in_title')}
              </Button>
            </form>
          </div>
        </div>
      )}
      <p className="text-muted-foreground mt-6 text-center text-xs leading-relaxed">
        {t('verification_note')}
      </p>
    </div>
  );
}
