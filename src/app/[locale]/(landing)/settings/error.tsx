'use client';

import React from 'react';
import { useLocale } from 'next-intl';

export default function SettingsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const chinese = useLocale().startsWith('zh');
  return (
    <section
      role="alert"
      className="mx-auto max-w-lg space-y-4 px-6 py-16 text-center"
    >
      <h1 className="text-xl font-semibold">
        {chinese
          ? '账户信息暂时无法加载'
          : 'Account details are temporarily unavailable'}
      </h1>
      <p className="text-muted-foreground">
        {chinese ? '请稍后重试。' : 'Please try again in a moment.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2"
      >
        {chinese ? '重试' : 'Try again'}
      </button>
    </section>
  );
}
