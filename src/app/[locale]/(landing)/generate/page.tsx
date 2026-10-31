import { redirect } from 'next/navigation';

import { studioUrl } from '@/config/preview/product';

export const metadata = { robots: { index: false, follow: false } };

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(studioUrl(undefined, locale));
}
