import { PasswordRecovery } from '@/shared/blocks/sign/password-recovery';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata({
  title: 'Password recovery — TattooVis',
  noIndex: true,
});

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return <PasswordRecovery mode="request" callbackUrl={callbackUrl} />;
}
