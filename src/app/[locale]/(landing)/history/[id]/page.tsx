import { notFound } from 'next/navigation';
import { getProjectWithGenerations } from '@/server/db/tattoo-queries';
import { setRequestLocale } from 'next-intl/server';

import { TattooGenerator } from '@/shared/blocks/tattoo/tattoo-generator';
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

  return <TattooGenerator key={id} projectId={id} />;
}
