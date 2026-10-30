import { createClerkClient } from '@clerk/backend';
import { parsePublishableKey } from '@clerk/shared/keys';

export async function verifyClerkIdentity(
  request: Request,
  config: { publishableKey: string; secretKey: string },
  origin: string
) {
  // Only accept an explicitly submitted session token; ambient Clerk cookies
  // must not silently sign a visitor back into the website after logout.
  if (!/^Bearer\s+\S+$/i.test(request.headers.get('authorization') || ''))
    throw new Error('CLERK_SESSION_REQUIRED');
  const clerk = createClerkClient(config);
  const key = parsePublishableKey(config.publishableKey, { fatal: true });
  const state = await clerk.authenticateRequest(request, {
    authorizedParties: [origin],
    acceptsToken: 'session_token',
    issuer: `https://${key.frontendApi}`,
  });
  if (!state.isAuthenticated) throw new Error('CLERK_SESSION_INVALID');
  const auth = state.toAuth();
  if (!auth.isAuthenticated || !auth.userId || !auth.sessionId)
    throw new Error('CLERK_SESSION_INVALID');
  const user = await clerk.users.getUser(auth.userId);
  const email = user.emailAddresses.find(
    (value) => value.id === user.primaryEmailAddressId
  );
  if (
    user.id !== auth.userId ||
    !email ||
    email.verification?.status !== 'verified' ||
    !user.externalAccounts.some(
      (value) =>
        value.provider === 'google' || value.provider === 'oauth_google'
    )
  )
    throw new Error('CLERK_GOOGLE_IDENTITY_REQUIRED');
  return {
    id: user.id,
    email: email.emailAddress.trim().toLowerCase(),
    name:
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      email.emailAddress.split('@')[0],
    image: user.imageUrl,
  };
}
