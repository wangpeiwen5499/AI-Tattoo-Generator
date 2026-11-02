'use client';

import { useState } from 'react';

import { Link } from '@/core/i18n/navigation';

export function GuidePromptActions({
  prompt,
  zh,
}: {
  prompt: string;
  zh: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
  }
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
      <button
        type="button"
        className="text-primary underline underline-offset-4"
        onClick={copy}
      >
        {zh ? '复制提示词' : 'Copy prompt'}
      </button>
      <Link
        href={{ pathname: '/studio', query: { prompt } }}
        className="text-primary underline underline-offset-4"
      >
        {zh ? '使用此提示词' : 'Use this prompt'}
      </Link>
      <span role="status">
        {status === 'copied'
          ? zh
            ? '已复制'
            : 'Copied'
          : status === 'error'
            ? zh
              ? '复制失败，请手动选择上方文字复制。'
              : 'Could not copy. Select the prompt above to copy manually.'
            : ''}
      </span>
    </div>
  );
}
