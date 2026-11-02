import { reportServerFailure } from '@/server/diagnostics';
import { toNextJsHandler } from 'better-auth/next-js';

import { getAuth } from '@/core/auth';
import { envConfigs } from '@/config';
import { isCloudflareWorker } from '@/shared/lib/env';
import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';
import { getAllConfigs } from '@/shared/models/config';

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
 * Matches the request origin against allowed origins (with and without www).
 */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin');
  const baseUrl = envConfigs.app_url;

  // Build trusted origins: base URL + www variant
  const trustedOrigins: string[] = [];
  if (baseUrl) {
    trustedOrigins.push(baseUrl);
    // Also add www variant (e.g. https://tattoovis.ink → https://www.tattoovis.ink)
    try {
      const url = new URL(baseUrl);
      const wwwVariant = `${url.protocol}//www.${url.host}${url.port ? ':' + url.port : ''}`;
      trustedOrigins.push(wwwVariant);
    } catch {
      // ignore invalid URLs
    }
  }

  // Allow localhost in development
  trustedOrigins.push('http://localhost:3000');

  // If origin matches a trusted origin, reflect it back (not wildcard — required for credentials)
  const allowedOrigin =
    origin &&
    trustedOrigins.some((t) => origin === t || origin.startsWith(t + ':'))
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

async function post(request: Request) {
  if (
    ['/sign-up/email', '/request-password-reset'].some((path) =>
      new URL(request.url).pathname.endsWith(path)
    )
  ) {
    const configs = await getAllConfigs();
    if (!configs.resend_api_key || !configs.resend_sender_email)
      return Response.json(
        {
          code: 'EMAIL_SERVICE_UNAVAILABLE',
          message:
            'Email verification is temporarily unavailable. Please try again later.',
        },
        { status: 503, headers: corsHeaders(request) }
      );
  }
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

async function get(request: Request) {
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

// Better Auth can return a 500 itself or throw before creating a response.
async function diagnose(
  request: Request,
  handler: (request: Request) => Promise<Response>
) {
  try {
    const response = await handler(request);
    if (response.status >= 500) {
      const requestId = reportServerFailure('auth.request', undefined);
      response.headers.set('X-Request-Id', requestId);
    }
    return response;
  } catch (error) {
    const requestId = reportServerFailure('auth.request', error);
    return Response.json(
      {
        code: 'AUTH_TEMPORARILY_UNAVAILABLE',
        message:
          'Account service is temporarily unavailable. Please try again.',
        requestId,
      },
      {
        status: 503,
        headers: {
          ...corsHeaders(request),
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
        },
      }
    );
  }
}
export const GET = (request: Request) => diagnose(request, get);
export const POST = (request: Request) => diagnose(request, post);
