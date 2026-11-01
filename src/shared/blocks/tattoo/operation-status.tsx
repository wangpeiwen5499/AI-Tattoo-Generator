import { Loader2 } from 'lucide-react';

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
      {error || text}
    </p>
  );
}
