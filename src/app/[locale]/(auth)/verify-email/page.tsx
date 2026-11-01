import { VerifyEmail } from '@/shared/blocks/sign/verify-email';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata({
  title: 'Verify email — AI Tattoo Generator',
  noIndex: true,
});
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    callbackUrl?: string;
    sent?: string;
  }>;
}) {
  const { email, callbackUrl, sent } = await searchParams;
  return (
    <VerifyEmail
      initialEmail={email || ''}
      callbackUrl={callbackUrl || '/studio'}
      alreadySent={sent === '1'}
    />
  );
}
