import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import { handleOAuthUserInfo } from 'better-auth/oauth2';
import { z } from 'zod';

import { verifyClerkIdentity } from './clerk-identity';

export function clerkSessionBridge(config: {
  publishableKey: string;
  secretKey: string;
}) {
  return {
    id: 'clerk-session-bridge',
    endpoints: {
      clerkSignIn: createAuthEndpoint(
        '/clerk/sign-in',
        {
          method: 'POST',
          body: z.object({}).strict(),
          requireHeaders: true,
        },
        async (ctx) => {
          const origin = new URL(ctx.context.baseURL).origin;
          if (!ctx.request || ctx.headers.get('origin') !== origin)
            throw new APIError('FORBIDDEN', {
              message: 'Invalid login origin.',
            });
          let identity;
          try {
            identity = await verifyClerkIdentity(ctx.request, config, origin);
          } catch {
            throw new APIError('UNAUTHORIZED', {
              message:
                'Unable to verify your Google session. Please sign in again.',
            });
          }
          // Reuse the same provider/account ID as prior Clerk OIDC sign-ins.
          // The existing auth adapter keeps user creation and the welcome gift atomic.
          const result = await handleOAuthUserInfo(ctx, {
            userInfo: { ...identity, emailVerified: true },
            account: { providerId: 'clerk', accountId: identity.id },
            trustProviderByName: false,
          });
          if (result.error === 'account not linked')
            throw new APIError('FORBIDDEN', {
              code: 'ACCOUNT_LINK_REQUIRED',
              message:
                'Sign in with your email and password and verify your email before linking Google.',
            });
          if (result.error || !result.data)
            throw new APIError('BAD_REQUEST', {
              message: 'Unable to complete Google sign in. Please try again.',
            });
          await setSessionCookie(ctx, result.data);
          return ctx.json({ status: true });
        }
      ),
    },
    rateLimit: [
      {
        pathMatcher: (path: string) => path === '/clerk/sign-in',
        window: 60,
        max: 5,
      },
    ],
  };
}
