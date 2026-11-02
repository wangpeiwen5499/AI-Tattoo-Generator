import { randomUUID } from 'node:crypto';

const safeCodes = new Set([
  '53300',
  '53400',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '57P01',
  '57P02',
  '57P03',
  '42P01',
  '42703',
  '42501',
  '28P01',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'CONNECT_TIMEOUT',
  'CONNECTION_CLOSED',
  'CONNECTION_ENDED',
]);

// Never log error messages/stacks: database wrappers can include full SQL and
// parameters, and auth/provider errors can include credentials or user input.
export function reportServerFailure(
  operation: 'auth.session' | 'auth.request' | 'studio.request',
  error: unknown,
  requestId: string = randomUUID()
) {
  const codes: string[] = [];
  let current: unknown = error;
  for (
    let depth = 0;
    depth < 5 && current && typeof current === 'object';
    depth++
  ) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === 'string' && safeCodes.has(value.code))
      codes.push(value.code);
    current = value.cause;
  }
  console.error('[server-failure]', {
    operation,
    requestId,
    codes: [...new Set(codes)],
  });
  return requestId;
}
