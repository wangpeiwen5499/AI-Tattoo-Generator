import { PasswordRecovery } from '@/shared/blocks/sign/password-recovery';
import { getMetadata } from '@/shared/lib/seo';

export const generateMetadata = getMetadata({
  title: 'Reset password — TattooVis',
  noIndex: true,
});

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
    error?: string;
    callbackUrl?: string;
  }>;
}) {
  const { token, error, callbackUrl } = await searchParams;
  return (
    <PasswordRecovery
      mode="reset"
      token={token}
      invalid={Boolean(error)}
      callbackUrl={callbackUrl}
    />
  );
}
