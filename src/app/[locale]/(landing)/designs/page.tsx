import { redirect } from 'next/navigation';

import { studioUrl } from '@/config/preview/product';

export const metadata = { robots: { index: false, follow: false } };

export default async function DesignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(studioUrl('designs', locale));
}
