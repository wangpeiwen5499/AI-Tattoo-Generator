import { parsePublishableKey } from '@clerk/shared/keys';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';

export function getClerkNativeConfig(
  env: Record<string, string | undefined> = process.env
) {
  const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  const secretKey = env.CLERK_SECRET_KEY?.trim();
  if (
    !publishableKey ||
    !secretKey ||
    !/^pk_(live|test)_/.test(publishableKey) ||
    !/^sk_(live|test)_/.test(secretKey)
  )
    return null;
  if (
    publishableKey.startsWith('pk_live_') !== secretKey.startsWith('sk_live_')
  )
    return null;
  if (!parsePublishableKey(publishableKey)) return null;
  return { publishableKey, secretKey };
}

// Server-side OAuth application credentials, distinct from Clerk SDK API keys.
export function getClerkOAuthConfig(
  env: Record<string, string | undefined> = process.env
): GenericOAuthConfig | null {
  const clientId = env.CLERK_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.CLERK_OAUTH_CLIENT_SECRET?.trim();
  const discoveryUrl = env.CLERK_OAUTH_DISCOVERY_URL?.trim();
  if (!clientId || !clientSecret || !discoveryUrl) return null;
  try {
    const url = new URL(discoveryUrl);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
  } catch {
    return null;
  }
  return {
    providerId: 'clerk',
    clientId,
    clientSecret,
    discoveryUrl,
    scopes: ['openid', 'email', 'profile'],
    pkce: true,
    // Use Clerk's verified email claim, never assume every identity is verified.
    mapProfileToUser(profile) {
      return {
        id: String(profile.sub || profile.id || ''),
        email: profile.email,
        emailVerified: profile.email_verified === true,
        name:
          profile.name ||
          [profile.given_name, profile.family_name].filter(Boolean).join(' ') ||
          profile.email?.split('@')[0],
        image: profile.picture,
      };
    },
  };
}
