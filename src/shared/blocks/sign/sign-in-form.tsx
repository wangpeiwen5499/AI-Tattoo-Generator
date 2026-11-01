'use client';

import { useAppContext } from '@/shared/contexts/app';

import { AuthFlow } from './auth-flow';

export function SignInForm({
  callbackUrl = '/',
  className,
}: {
  callbackUrl: string;
  className?: string;
}) {
  const { configs, setIsShowSignModal } = useAppContext();
  return (
    <AuthFlow
      configs={configs}
      callbackUrl={callbackUrl}
      className={className}
      onAuthenticated={() => setIsShowSignModal(false)}
    />
  );
}
