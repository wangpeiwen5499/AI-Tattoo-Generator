import Link from 'next/link';
import { BODY_PART_LABELS, BODY_PARTS, type BodyPart } from '@/lib/constants';
import { getPublicUrl } from '@/lib/r2';
import {
  countUserTattooProjects,
  listUserTattooProjects,
} from '@/server/db/tattoo-queries';
import { setRequestLocale } from 'next-intl/server';

import { getMetadata } from '@/shared/lib/seo';
import { getUserInfo } from '@/shared/models/user';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export const generateMetadata = getMetadata({
  title: 'My Tattoo History — AI Tattoo Generator',
  description: 'View your past AI-generated tattoo previews.',
  canonicalUrl: '/history',
  noIndex: true,
});

export default async function HistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getUserInfo();
  if (!user?.id) {
    return (
      <section className="py-24 md:py-36">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-4 text-3xl font-bold">My Tattoo History</h1>
            <p className="text-muted-foreground mb-6">
              Sign in to view your generated tattoo previews.
            </p>
            <Link
              href="/sign-in"
              className="text-primary text-sm font-medium underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const requested = Number((await searchParams).page);
  const page =
    Number.isSafeInteger(requested) && requested > 0
      ? Math.min(requested, 100000)
      : 1;
  const [projects, total] = await Promise.all([
    listUserTattooProjects(user.id, { page, limit: 20 }),
    countUserTattooProjects(user.id),
  ]);
  const historyUrl = `${locale === 'en' ? '' : `/${locale}`}/history`;

  return (
    <section className="py-24 md:py-36">
      <div className="container">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h1 className="mb-3 text-3xl font-bold tracking-tight lg:text-4xl">
              My Tattoo History
            </h1>
            <p className="text-muted-foreground">
              {projects.length === 0
                ? 'No generations yet. Create your first tattoo preview!'
                : `${total} generation${total > 1 ? 's' : ''}`}
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="text-center">
              <Link
                href="/generate"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium shadow transition-colors"
              >
                Generate your first tattoo
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group border-border/40 bg-card overflow-hidden rounded-xl border shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Tattoo design preview */}
                  {project.tattooDesignUrl ? (
                    <div className="bg-muted/30 aspect-square overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.tattooDesignUrl}
                        alt={project.prompt}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="bg-muted/20 text-muted-foreground flex aspect-square items-center justify-center text-xs">
                      No preview
                    </div>
                  )}

                  {/* Info */}
                  <div className="p-4">
                    <p className="line-clamp-2 text-sm font-medium">
                      {project.prompt}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {BODY_PARTS.map((bp) => {
                        const gen = project.generations.find(
                          (g) => g.bodyPart === bp
                        );
                        const hasImage =
                          gen?.status === 'completed' && gen?.r2Url;
                        return (
                          <span
                            key={bp}
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
                              hasImage
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {BODY_PART_LABELS[bp as BodyPart]}
                            {hasImage ? ' ✓' : ''}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground mt-3 text-xs">
                      {project.status === 'processing' && (
                        <span className="text-primary mr-2 font-medium">
                          In progress
                        </span>
                      )}
                      {project.resolution} · {project.creditsCost}{' '}
                      {project.creditsCost === 1 ? 'credit' : 'credits'} ·{' '}
                      {new Date(project.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  {/* Quick view link */}
                  <Link
                    href={`/history/${project.id}`}
                    className="border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground block border-t px-4 py-2.5 text-center text-xs font-medium transition-colors"
                  >
                    {project.status === 'processing'
                      ? 'Resume generation →'
                      : 'View details →'}
                  </Link>
                </div>
              ))}
            </div>
          )}
          <nav
            aria-label="History pages"
            className="mt-8 flex items-center justify-center gap-6 text-sm"
          >
            {page > 1 && (
              <Link href={`${historyUrl}?page=${page - 1}`}>Previous</Link>
            )}
            <span>Page {page}</span>
            {page * 20 < total && (
              <Link href={`${historyUrl}?page=${page + 1}`}>Next</Link>
            )}
          </nav>
        </div>
      </div>
    </section>
  );
}
