'use client';

import { AuthFlow } from './auth-flow';

export function SignIn({
  configs,
  callbackUrl = '/',
  socialError = false,
}: {
  configs: Record<string, string>;
  callbackUrl: string;
  socialError?: boolean;
}) {
  return (
    <div className="bg-card text-card-foreground mx-auto w-full max-w-md rounded-3xl border p-6 shadow-sm sm:p-8">
      <AuthFlow
        configs={configs}
        callbackUrl={callbackUrl}
        socialError={socialError}
      />
    </div>
  );
}
