'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  HandleSSOCallback,
  RedirectToTasks,
  SignIn,
  SignUp,
  useAuth,
  useClerk,
  useSignIn,
} from '@clerk/react';
import { Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';
import { safeAuthCallback } from '@/shared/lib/auth-callback';

export function ClerkGoogleFlow({
  publishableKey,
  step,
  callbackUrl,
  signup = false,
}: {
  publishableKey: string;
  step: string;
  callbackUrl?: string;
  signup?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations('common.sign');
  const destination = safeAuthCallback(callbackUrl, locale);
  const route = (stage: string, isSignup = false) =>
    safeAuthCallback(
      `/auth/google/${stage}?callbackUrl=${encodeURIComponent(destination)}${isSignup ? '&mode=signup' : ''}`,
      locale
    );
  const complete = route('complete');
  const continuation = route('continue');
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInUrl={continuation}
      signUpUrl={route('continue', true)}
      signInFallbackRedirectUrl={complete}
      signUpFallbackRedirectUrl={complete}
    >
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 text-center">
        <ClerkLoading>
          <Working />
        </ClerkLoading>
        <ClerkFailed>
          <p role="alert">{t('social_failed')}</p>
        </ClerkFailed>
        <ClerkLoaded>
          {step === 'start' && (
            <StartGoogle
              callback={route('callback')}
              complete={route('tasks')}
            />
          )}
          {step === 'callback' && (
            <>
              <Working />
              <HandleSSOCallback
                navigateToApp={({ session }) =>
                  window.location.replace(
                    session?.currentTask ? route('tasks') : complete
                  )
                }
                navigateToSignIn={() => window.location.replace(continuation)}
                navigateToSignUp={() =>
                  window.location.replace(route('continue', true))
                }
              />
            </>
          )}
          {step === 'tasks' && <RedirectToTasks redirectUrl={complete} />}
          {step === 'continue' &&
            (signup ? (
              <SignUp
                routing="hash"
                signInUrl={continuation}
                forceRedirectUrl={complete}
              />
            ) : (
              <SignIn
                routing="hash"
                signUpUrl={route('continue', true)}
                forceRedirectUrl={complete}
              />
            ))}
          {step === 'complete' && <CompleteGoogle destination={destination} />}
        </ClerkLoaded>
        <Link
          className="text-muted-foreground text-sm underline"
          href={`/sign-in?callbackUrl=${encodeURIComponent(destination)}`}
        >
          {t('back_to_sign_in')}
        </Link>
      </div>
    </ClerkProvider>
  );
}

function Working() {
  const t = useTranslations('common.sign');
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-8">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      <span>{t('google_connecting')}</span>
    </div>
  );
}

function StartGoogle({
  callback,
  complete,
}: {
  callback: string;
  complete: string;
}) {
  const { signIn } = useSignIn();
  const clerk = useClerk();
  const t = useTranslations('common.sign');
  const started = useRef(false);
  const [error, setError] = useState(false);
  async function begin() {
    setError(false);
    try {
      // Website logout ends its Better Auth session. Explicitly choosing Google
      // again must also clear a residual Clerk session so account selection works
      // on Clerk's default single-session instances. The callback avoids a reload.
      if (clerk.session)
        await clerk.signOut(() => {}, { sessionId: clerk.session.id });
      const result = await signIn.sso({
        strategy: 'oauth_google',
        oidcPrompt: 'select_account',
        redirectCallbackUrl: callback,
        redirectUrl: complete,
      });
      if (result.error) setError(true);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
    // Only initiate once per visit; Clerk signal updates must not restart OAuth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return error ? (
    <div className="space-y-4">
      <p role="alert">{t('social_failed')}</p>
      <Button onClick={begin}>{t('google_sign_in_title')}</Button>
    </div>
  ) : (
    <Working />
  );
}

function CompleteGoogle({ destination }: { destination: string }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const t = useTranslations('common.sign');
  const started = useRef(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!isLoaded || started.current) return;
    started.current = true;
    void (async () => {
      try {
        if (!isSignedIn) throw new Error('NO_SESSION');
        const token = await getToken({ skipCache: true });
        if (!token) throw new Error('NO_SESSION');
        const response = await fetch('/api/auth/clerk/sign-in', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            'content-type': 'application/json',
            authorization: `Bearer ${token}`,
          },
          body: '{}',
        });
        const result = await response.json();
        if (!response.ok) {
          setError(
            t(
              result.code === 'ACCOUNT_LINK_REQUIRED'
                ? 'google_link_required'
                : 'social_failed'
            )
          );
          return;
        }
        window.location.replace(destination);
      } catch {
        setError(t('social_failed'));
      }
    })();
  }, [isLoaded, isSignedIn, getToken, destination, t]);
  return error ? (
    <p role="alert" className="text-sm leading-relaxed">
      {error}
    </p>
  ) : (
    <Working />
  );
}
