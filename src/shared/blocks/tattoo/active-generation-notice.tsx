'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { useSession } from '@/core/auth/client';
import { Link } from '@/core/i18n/navigation';

export function ActiveGenerationNotice() {
  const { data } = useSession();
  const pathname = usePathname();
  const t = useTranslations('common.funnel');
  const [projectId, setProjectId] = useState<string | null>(null);
  useEffect(() => {
    if (!data?.user) {
      return;
    }
    let alive = true;
    const controller = new AbortController();
    const check = async () => {
      try {
        const response = await fetch('/api/ai/generate-tattoo/status', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 204) {
          if (alive) setProjectId(null);
          return;
        }
        if (!response.ok) return;
        const task = await response.json();
        if (alive)
          setProjectId(task.status === 'processing' ? task.projectId : null);
      } catch {}
    };
    void check();
    const timer = setInterval(check, 15_000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [data?.user?.id, pathname]);
  if (
    !data?.user ||
    !projectId ||
    pathname.includes('/generate') ||
    /\/history\/[^/]+/.test(pathname)
  )
    return null;
  return (
    <aside className="container pt-24" aria-label={t('activeGeneration')}>
      <div className="border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4 text-sm">
        <p>{t('activeGeneration')}</p>
        <Link
          href={`/generate?projectId=${encodeURIComponent(projectId)}`}
          className="text-primary font-semibold underline underline-offset-4"
        >
          {t('resumeGeneration')} →
        </Link>
      </div>
    </aside>
  );
}
