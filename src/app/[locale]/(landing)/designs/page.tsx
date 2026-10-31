import { notFound, redirect } from 'next/navigation';

import { isProductPreview, studioUrl } from '@/config/preview/product';

export const metadata = { robots: { index: false, follow: false } };

export default async function DesignsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!isProductPreview()) notFound();
  const { locale } = await params;
  redirect(studioUrl('designs', locale));
}
