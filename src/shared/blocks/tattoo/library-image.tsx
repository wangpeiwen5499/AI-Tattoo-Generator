'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';

/** Failed thumbnails retry only after an explicit user action. */
export function LibraryImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  const zh = useLocale() === 'zh';
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  const retrySource = attempt
    ? `${src}${src.includes('?') ? '&' : '?'}thumbnailRetry=${attempt}`
    : src;
  return (
    <div className={`bg-muted overflow-hidden ${className}`}>
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
          <p role="status" className="text-muted-foreground text-sm">
            {zh ? '暂时无法加载图片' : 'Could not load image'}
            <span className="sr-only">: {alt}</span>
          </p>
          <button
            type="button"
            onClick={() => {
              setAttempt((value) => value + 1);
              setFailed(false);
            }}
            className="min-h-11 rounded-full border px-4 text-sm"
          >
            {zh ? '重试图片' : 'Retry image'}
          </button>
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={retrySource}
          src={retrySource}
          alt={alt}
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
