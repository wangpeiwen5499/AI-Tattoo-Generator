'use client';

import { AuthFlow } from './auth-flow';

export function SignUp({
  configs,
  callbackUrl = '/',
}: {
  configs: Record<string, string>;
  callbackUrl: string;
}) {
  return (
    <div className="bg-card text-card-foreground mx-auto w-full max-w-md rounded-3xl border p-6 shadow-sm sm:p-8">
      <AuthFlow
        configs={configs}
        callbackUrl={callbackUrl}
        initialMode="sign-up"
      />
    </div>
  );
}
