'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Link } from '@/core/i18n/navigation';

export function OperationStatus({
  phase,
  locale,
  error,
}: {
  phase: string;
  locale: string;
  error?: string;
}) {
  const zh = locale === 'zh';
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000
    );
    return () => clearInterval(timer);
  }, []);
  const submitted = [
    'queued',
    'running',
    'submitted',
    'persisting',
    'review_required',
  ].includes(phase);
  const text =
    phase === 'uploading'
      ? zh
        ? '正在准备并上传图片…'
        : 'Uploading your images…'
      : phase === 'submitting'
        ? zh
          ? '正在提交生成任务…'
          : 'Submitting your request…'
        : phase === 'loading'
          ? zh
            ? '生成完成，正在加载图片…'
            : 'Generation complete. Loading your image…'
          : phase === 'processing'
            ? zh
              ? '正在打开图片…'
              : 'Opening your image…'
            : zh
              ? 'AI 正在生成，请稍候。任务提交后可稍后回来查看。'
              : 'AI is generating your image. Once submitted, you can return later to check it.';
  return (
    <p
      role={error ? 'alert' : 'status'}
      className={`mt-3 flex items-start gap-2 text-sm leading-6 ${error ? 'text-destructive' : 'text-primary'}`}
    >
      {!error && (
        <Loader2
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 animate-spin motion-reduce:animate-none"
        />
      )}
      <span>
        {error || text}
        {!error && submitted && (
          <span className="mt-1 block">
            {zh ? `已等待 ${seconds} 秒 · ` : `Elapsed ${seconds}s · `}
            <Link href="/history" className="underline">
              {zh ? '在历史记录查看进度' : 'View progress in history'}
            </Link>
          </span>
        )}
      </span>
    </p>
  );
}
