// Resolved server settings only. Never expose the client secret to the browser.
export function getGoogleProviderConfig(configs: Record<string, string>) {
  const clientId = configs.google_client_id?.trim();
  const clientSecret = configs.google_client_secret?.trim();
  if (configs.google_auth_enabled !== 'true' || !clientId || !clientSecret)
    return null;
  return { clientId, clientSecret, prompt: 'select_account' as const };
}
