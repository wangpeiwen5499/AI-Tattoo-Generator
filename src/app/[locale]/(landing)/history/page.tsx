import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';

import { getMetadata } from '@/shared/lib/seo';
import { getUserInfo } from '@/shared/models/user';
import { listUserTattooProjects } from '@/server/db/tattoo-queries';
import { getPublicUrl } from '@/lib/r2';
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '@/lib/constants';

export const revalidate = 0;
export const dynamic = 'force-dynamic';

export const generateMetadata = getMetadata({
  title: 'My Tattoo History — AI Tattoo Generator',
  description: 'View your past AI-generated tattoo previews.',
  canonicalUrl: '/history',
});

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
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
            <p className="mb-6 text-muted-foreground">
              Sign in to view your generated tattoo previews.
            </p>
            <Link
              href="/sign-in"
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const projects = await listUserTattooProjects(user.id);

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
                : `${projects.length} generation${projects.length > 1 ? 's' : ''}`}
            </p>
          </div>

          {projects.length === 0 ? (
            <div className="text-center">
              <Link
                href="/generate"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
              >
                Generate your first tattoo
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Tattoo design preview */}
                  {project.tattooDesignUrl ? (
                    <div className="aspect-square overflow-hidden bg-muted/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={project.tattooDesignUrl}
                        alt={project.prompt}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-square items-center justify-center bg-muted/20 text-xs text-muted-foreground">
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
                        const gen = project.generations.find((g) => g.bodyPart === bp);
                        const hasImage = gen?.status === 'completed' && gen?.r2Url;
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
                    <p className="mt-3 text-xs text-muted-foreground">
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
                    className="block border-t border-border/40 px-4 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    View details →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
