import { redirect } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { studioUrl } from '@/config/preview/product';
import { getMetadata } from '@/shared/lib/seo';

export const dynamic = 'force-dynamic';
export const generateMetadata = getMetadata({
  title: 'Tattoo try-on history | TattooVis',
  canonicalUrl: '/history',
  noIndex: true,
});
export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect(studioUrl('history', locale));
}
