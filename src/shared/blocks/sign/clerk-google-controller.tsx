'use client';

import { useEffect } from 'react';
import { ClerkFailed, ClerkLoaded, ClerkProvider } from '@clerk/react';

import { safeAuthCallback } from '@/shared/lib/auth-callback';

import { StartGoogle } from './clerk-google-flow';

export function NativeGoogleController({
  publishableKey,
  requested,
  destination,
  locale,
  onFailure,
}: {
  publishableKey: string;
  requested: boolean;
  destination: string;
  locale: string;
  onFailure: () => void;
}) {
  const route = (stage: string) =>
    safeAuthCallback(
      `/auth/google/${stage}?callbackUrl=${encodeURIComponent(destination)}`,
      locale
    );
  return (
    <ClerkProvider
      publishableKey={publishableKey}
      prefetchUI={false}
      signInUrl={route('continue')}
      signUpUrl={`${route('continue')}&mode=signup`}
      signInFallbackRedirectUrl={route('tasks')}
      signUpFallbackRedirectUrl={route('tasks')}
    >
      <ClerkFailed>
        <ReportFailure enabled={requested} onFailure={onFailure} />
      </ClerkFailed>
      <ClerkLoaded>
        {requested && (
          <StartGoogle
            callback={route('callback')}
            complete={route('tasks')}
            onFailure={onFailure}
          />
        )}
      </ClerkLoaded>
    </ClerkProvider>
  );
}

function ReportFailure({
  enabled,
  onFailure,
}: {
  enabled: boolean;
  onFailure: () => void;
}) {
  useEffect(() => {
    if (enabled) onFailure();
  }, [enabled, onFailure]);
  return null;
}
