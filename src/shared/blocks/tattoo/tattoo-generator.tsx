'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCredits } from '@/hooks/use-credits';
import { useGeneration } from '@/hooks/use-generation';
import { CREDITS_PER_GENERATION } from '@/lib/constants';
import { ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { useSession } from '@/core/auth/client';
import { CreditsBadge } from '@/shared/blocks/tattoo/credits-badge';
import { GenerationProgress } from '@/shared/blocks/tattoo/generation-progress';
import { GenerationResults } from '@/shared/blocks/tattoo/generation-results';
import { ImageUploader } from '@/shared/blocks/tattoo/image-uploader';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';

export function TattooGenerator() {
  const router = useRouter();
  const credits = useCredits();
  const gen = useGeneration();
  const { data: session, isPending: sessionLoading } = useSession();
  const isSignedIn = !!session?.user && !sessionLoading;

  const lastErrorRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gen.error) return;
    if (lastErrorRef.current === gen.error) return;
    lastErrorRef.current = gen.error;
    toast.error(gen.error);
  }, [gen.error]);

  useEffect(() => {
    if (gen.status === 'completed' || gen.status === 'error') {
      credits.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status]);

  useEffect(() => {
    const retryTimer = { current: 0 as number };
    const handleRefresh = () => {
      credits.refresh();
      window.clearTimeout(retryTimer.current);
      retryTimer.current = window.setTimeout(() => credits.refresh(), 2500);
    };
    window.addEventListener('credits:refresh', handleRefresh);
    return () => {
      window.removeEventListener('credits:refresh', handleRefresh);
      window.clearTimeout(retryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFile(file: File) {
    try {
      await gen.uploadPhoto(file);
      toast.success('Photo uploaded');
    } catch {
      // error shown via gen.error → toast
    }
  }

  async function handleGenerate() {
    if (credits.credits === null) {
      toast.error('Loading credits, please wait a moment');
      return;
    }
    if (credits.credits < CREDITS_PER_GENERATION) {
      if (isSignedIn) {
        toast.error("You're out of credits", {
          description: 'Buy credits to keep generating',
          action: {
            label: 'Buy Credits',
            onClick: () => router.push('/pricing'),
          },
        });
      } else {
        toast.error("You've used your free preview", {
          description: 'Sign up to get 3 more previews',
          action: { label: 'Sign up', onClick: () => router.push('/sign-in') },
        });
      }
      return;
    }
    try {
      await gen.generate();
    } catch {
      // error shown via gen.error → toast
    }
  }

  const isGuestOutOfCredits =
    !isSignedIn &&
    credits.credits !== null &&
    credits.credits < CREDITS_PER_GENERATION;

  // --- generating ---
  if (gen.status === 'generating') {
    return (
      <section className="py-24 md:py-36">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-end">
              <CreditsBadge
                credits={credits.credits}
                loading={credits.loading}
              />
            </div>
            <GenerationProgress
              progress={gen.generateProgress}
              stageLabel={gen.stageLabel}
              elapsedSeconds={gen.elapsedSeconds}
            />
          </div>
        </div>
      </section>
    );
  }

  // --- completed / error with result ---
  if (gen.result && (gen.status === 'completed' || gen.status === 'error')) {
    return (
      <section className="py-24 md:py-36">
        <div className="container">
          <div className="mx-auto max-w-3xl">
            <div className="mb-6 flex items-center justify-end">
              <CreditsBadge
                credits={credits.credits}
                loading={credits.loading}
              />
            </div>
            <GenerationResults
              tattooDesignUrl={gen.result.tattooDesignUrl}
              images={gen.result.images}
              refunded={gen.refunded}
              onRegenerate={gen.resetPrompt}
              onReset={gen.reset}
            />
          </div>
        </div>
      </section>
    );
  }

  // --- idle / uploading / ready: the main form ---
  const ready = !!gen.photoKey && !!gen.photoUrl && gen.status !== 'uploading';

  return (
    <section className="py-24 md:py-36">
      <div className="container">
        <div className="mx-auto max-w-3xl">
          {/* --- Title + Free trial --- */}
          <div className="mb-8 text-center">
            <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
              AI Tattoo Generator
            </h2>
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="text-base">🎁</span>3 free previews per day per
              network · Sign up to get 3 more
            </div>
          </div>

          {gen.error && (
            <p role="alert" className="text-destructive mb-4 text-sm">
              {gen.error}
              {gen.refunded ? ' Your credit has been returned.' : ''}
            </p>
          )}

          {/* --- Credits --- */}
          <div className="mb-5 flex items-center justify-end">
            <CreditsBadge credits={credits.credits} loading={credits.loading} />
          </div>

          {/* --- Main generator card --- */}
          <div className="border-border/40 bg-card overflow-hidden rounded-2xl border shadow-xl shadow-zinc-950/5">
            {/* ---- Upload section ---- */}
            <div className="p-6 md:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-xs font-bold text-sky-600 dark:text-sky-400">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-semibold">Upload your photo</h3>
                  <p className="text-muted-foreground text-xs">
                    Take a clear, well-lit photo of the body part
                  </p>
                </div>
              </div>
              <ImageUploader
                photoUrl={gen.photoUrl}
                uploading={gen.status === 'uploading'}
                uploadProgress={gen.uploadProgress}
                onFileSelected={handleFile}
                onClear={gen.clearPhoto}
              />
              <p className="text-muted-foreground mt-3 text-xs">
                Photos are sent to our AI and storage providers. Anyone with an
                image link can view it. Please avoid sensitive photos and read
                our{' '}
                <Link href="/privacy-policy" className="underline">
                  Privacy Policy
                </Link>{' '}
                before uploading.
              </p>
            </div>

            {/* ---- Divider ---- */}
            <div className="flex items-center gap-3 px-6 md:px-8">
              <div className="bg-border/60 h-px flex-1" />
              <span className="text-muted-foreground/60 text-[10px] font-medium tracking-widest uppercase">
                then describe
              </span>
              <div className="bg-border/60 h-px flex-1" />
            </div>

            {/* ---- Describe + Generate section ---- */}
            <div className="p-6 md:p-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-xs font-bold text-violet-600 dark:text-violet-400">
                  2
                </span>
                <div>
                  <h3 className="text-sm font-semibold">
                    Describe your tattoo idea
                  </h3>
                  <p className="text-muted-foreground text-xs">
                    Style, colors, size, and any reference elements
                  </p>
                </div>
              </div>

              <Textarea
                value={gen.prompt}
                onChange={(e) => gen.setPrompt(e.target.value)}
                placeholder="e.g. A dragon wrapped around my forearm in Japanese irezumi style, bold black lines with crimson red accents, detailed scales, half-sleeve size"
                rows={3}
                maxLength={500}
                className="resize-none text-base leading-relaxed"
              />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  {gen.prompt.length}/500
                </p>
                {gen.prompt.trim().length >= 10 && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    ✓ Ready
                  </span>
                )}
              </div>

              {/* ---- Bottom bar: cost + button ---- */}
              <div className="border-border/40 mt-5 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">
                      {CREDITS_PER_GENERATION} credit
                    </span>
                    <span className="text-muted-foreground"> · </span>
                    {isSignedIn ? (
                      <span className="text-muted-foreground">
                        {credits.credits !== null
                          ? `${credits.credits} left`
                          : '...'}
                      </span>
                    ) : (
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        Free preview
                      </span>
                    )}
                    <span className="text-muted-foreground hidden sm:inline">
                      {' '}
                      · 4 previews
                    </span>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={
                    isGuestOutOfCredits
                      ? () => router.push('/sign-in')
                      : handleGenerate
                  }
                  disabled={
                    !isGuestOutOfCredits &&
                    (!ready || !gen.prompt.trim() || gen.status === 'uploading')
                  }
                  className="group h-12 gap-2 px-7 text-base font-semibold shadow-md transition-all hover:shadow-lg"
                >
                  {isGuestOutOfCredits ? (
                    'Sign up for 3 more'
                  ) : gen.status === 'uploading' ? (
                    'Uploading...'
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
                      Generate My Tattoo Preview
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
