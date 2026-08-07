import { toNextJsHandler } from 'better-auth/next-js';

import { envConfigs } from '@/config';
import { getAuth } from '@/core/auth';
import { isCloudflareWorker } from '@/shared/lib/env';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

function maybeRateLimitGetSession(request: Request): Response | null {
  const url = new URL(request.url);
  // better-auth session endpoint is served under this catch-all route.
  if (isCloudflareWorker || !url.pathname.endsWith('/api/auth/get-session')) {
    return null;
  }

  const intervalMs =
    Number(process.env.AUTH_GET_SESSION_MIN_INTERVAL_MS) ||
    // default: 800ms (enough to stop request storms but still responsive)
    800;

  return enforceMinIntervalRateLimit(request, {
    intervalMs,
    keyPrefix: 'auth-get-session',
  });
}

/**
 * Returns CORS headers based on trusted origins.
 * Uses the same trustedOrigins from auth config, plus app_url.
 */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const trustedOrigins = envConfigs.app_url
    ? [envConfigs.app_url]
    : [];

  // If origin matches a trusted origin, reflect it back (not wildcard)
  const allowedOrigin =
    origin && trustedOrigins.some((t) => origin.startsWith(t))
      ? origin
      : trustedOrigins[0] || '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };
}

export async function OPTIONS(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
}

export async function POST(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  const auth = await getAuth();
  const handler = toNextJsHandler(auth.handler);
  const response = await handler.POST(request);

  // Merge CORS headers into the response
  const headers = corsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export async function GET(request: Request) {
  const limited = maybeRateLimitGetSession(request);
  if (limited) {
    return limited;
  }

  const auth = await getAuth();
  const handler = toNextJsHandler(auth.handler);
  const response = await handler.GET(request);

  // Merge CORS headers into the response
  const headers = corsHeaders(request);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
