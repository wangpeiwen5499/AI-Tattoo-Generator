'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';

export type LightboxImage = { url: string; alt: string };

interface LightboxProps {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onCloseAutoFocus?: (event: Event) => void;
  labels?: {
    close?: string;
    description?: string;
    previous?: string;
    next?: string;
  };
}

export function Lightbox({
  images,
  index,
  onClose,
  onIndexChange,
  onCloseAutoFocus,
  labels,
}: LightboxProps) {
  const open = index !== null;
  const current = open ? images[index] : null;

  const goPrev = () => {
    if (index === null) return;
    onIndexChange((index - 1 + images.length) % images.length);
  };
  const goNext = () => {
    if (index === null) return;
    onIndexChange((index + 1) % images.length);
  };

  useEffect(() => {
    if (!open || images.length <= 1) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, images.length]);

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
          onCloseAutoFocus={onCloseAutoFocus}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {current?.alt ?? 'Image preview'}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {labels?.description ??
              (images.length > 1
                ? 'Use left and right arrow keys to navigate. Press Escape to close.'
                : 'Press Escape to close.')}
          </DialogPrimitive.Description>

          {current && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={current.alt}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}

          <DialogPrimitive.Close
            aria-label={labels?.close ?? 'Close'}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-6 w-6" />
          </DialogPrimitive.Close>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label={labels?.previous ?? 'Previous image'}
                className="absolute top-1/2 left-4 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label={labels?.next ?? 'Next image'}
                className="absolute top-1/2 right-4 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white">
                {(index ?? 0) + 1} / {images.length}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
