export function missingDeploymentSettings(
  env: Record<string, string | undefined>,
  settings: Record<string, string | undefined> = {}
): string[] {
  const missing: string[] = [];
  for (const key of [
    'DATABASE_URL',
    'AUTH_SECRET',
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'R2_PUBLIC_URL',
    'KIE_API_KEY',
  ]) {
    if (!env[key]?.trim()) missing.push(key);
    else if (key === 'AUTH_SECRET' && env[key]!.length < 32)
      missing.push('AUTH_SECRET (at least 32 characters)');
  }
  const emailEnabled =
    (env.EMAIL_AUTH_ENABLED || settings.email_auth_enabled) !== 'false';
  if (emailEnabled)
    for (const key of ['RESEND_API_KEY', 'RESEND_SENDER_EMAIL']) {
      if (
        !(
          env[key] ||
          env[key.toLowerCase()] ||
          settings[key.toLowerCase()]
        )?.trim()
      )
        missing.push(key);
    }
  return missing;
}
