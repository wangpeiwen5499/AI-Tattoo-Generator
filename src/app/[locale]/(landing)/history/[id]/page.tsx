import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BODY_PART_LABELS, BODY_PARTS, type BodyPart } from '@/lib/constants';
import { getProjectWithGenerations } from '@/server/db/tattoo-queries';
import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { getUserInfo } from '@/shared/models/user';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export const generateMetadata = getMetadata({
  title: 'Tattoo Preview Details — AI Tattoo Generator',
  canonicalUrl: '/history',
});

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const user = await getUserInfo();
  if (!user?.id) {
    notFound();
  }

  const project = await getProjectWithGenerations(id);
  if (!project || project.userId !== user.id) {
    notFound();
  }

  const sortedGenerations = [...project.generations].sort(
    (a, b) =>
      BODY_PARTS.indexOf(a.bodyPart as BodyPart) -
      BODY_PARTS.indexOf(b.bodyPart as BodyPart)
  );

  return (
    <section className="py-24 md:py-36">
      <div className="container">
        <div className="mx-auto max-w-4xl">
          {/* Back link */}
          <Link
            href="/history"
            className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-1 text-sm"
          >
            ← Back to history
          </Link>

          <h1 className="mb-2 text-2xl font-bold tracking-tight lg:text-3xl">
            Tattoo Preview
          </h1>
          <p className="text-muted-foreground mb-8">{project.prompt}</p>
          <p className="text-muted-foreground mb-6 text-sm">
            {project.resolution} · {project.creditsCost}{' '}
            {project.creditsCost === 1 ? 'credit' : 'credits'}
          </p>

          {/* Tattoo design */}
          {project.tattooDesignUrl && (
            <div className="mb-8">
              <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
                Design
              </h2>
              <div className="border-border/40 bg-muted/10 overflow-hidden rounded-xl border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={project.tattooDesignUrl}
                  alt="Tattoo design"
                  className="mx-auto max-h-96 object-contain"
                />
              </div>
            </div>
          )}

          {/* 4 body part results */}
          <h2 className="text-muted-foreground mb-3 text-sm font-semibold tracking-wider uppercase">
            Body Previews
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {sortedGenerations.map((gen) => {
              const label =
                BODY_PART_LABELS[gen.bodyPart as BodyPart] ?? gen.bodyPart;
              return (
                <div
                  key={gen.bodyPart}
                  className="border-border/40 bg-muted/10 overflow-hidden rounded-xl border"
                >
                  <div className="border-border/20 flex items-center gap-2 border-b px-4 py-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        gen.status === 'completed'
                          ? 'bg-emerald-500'
                          : 'bg-destructive'
                      }`}
                    />
                    <span className="text-sm font-medium">{label}</span>
                    {gen.status === 'failed' && (
                      <span className="text-muted-foreground text-xs">
                        Failed
                      </span>
                    )}
                  </div>
                  {gen.r2Url ? (
                    <div className="bg-muted/20 aspect-[3/4]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={gen.r2Url}
                        alt={`${label} preview`}
                        className="h-full w-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted/10 text-muted-foreground flex aspect-[3/4] items-center justify-center text-xs">
                      No result
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
