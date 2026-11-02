import { randomUUID } from 'node:crypto';

const safeCodes = new Set([
  '53300',
  '53400',
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08P01',
  '22P02',
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

// Only fixed classifications leave this function. Message text is inspected in
// memory because poolers sometimes omit structured codes; it is never logged.
const patterns: ReadonlyArray<readonly [string, RegExp]> = [
  ['pooler_session_limit', /MaxClientsInSessionMode/i],
  [
    'connection_limit',
    /too many (?:database )?connections|remaining connection slots|Max client connections reached/i,
  ],
  ['invalid_uuid', /invalid input syntax for (?:type )?uuid/i],
  [
    'network_failure',
    /fetch failed|network (?:error|failure)|ECONNRESET|ECONNREFUSED/i,
  ],
  ['timeout', /timed?\s*out|timeout/i],
  ['missing_column', /column[^\r\n]{0,200}does not exist/i],
];

// Never log raw messages/stacks: wrappers can contain full SQL and parameters,
// and auth/provider errors can contain credentials or user input.
export function reportServerFailure(
  operation:
    'auth.session' | 'auth.request' | 'auth.internal' | 'studio.request',
  error: unknown,
  requestId: string = randomUUID()
) {
  const codes = new Set<string>();
  const classifications = new Set<string>();
  const seen = new Set<unknown>();
  function inspect(current: unknown, depth: number) {
    if (depth > 5 || seen.has(current)) return;
    seen.add(current);
    if (Array.isArray(current)) {
      for (const item of current.slice(0, 10)) inspect(item, depth + 1);
      return;
    }
    let message: unknown = current;
    if (current && typeof current === 'object') {
      const value = current as {
        code?: unknown;
        cause?: unknown;
        message?: unknown;
      };
      if (typeof value.code === 'string' && safeCodes.has(value.code))
        codes.add(value.code);
      message = value.message;
      inspect(value.cause, depth + 1);
    }
    if (typeof message === 'string') {
      const bounded = message.slice(0, 8192);
      for (const [classification, pattern] of patterns) {
        if (pattern.test(bounded)) classifications.add(classification);
      }
    }
  }
  inspect(error, 0);
  console.error('[server-failure]', {
    operation,
    requestId,
    codes: [...codes],
    classifications: [...classifications],
  });
  return requestId;
}

// Better Auth logs the original driver error here before replacing it with an
// APIError that discards its cause. Always override its raw console logger.
export const safeAuthLogger = {
  disabled: false,
  level: 'error' as const,
  verboseLogging: false,
  log(level: string, _message: string, ...args: unknown[]) {
    if (level === 'error') reportServerFailure('auth.internal', args);
  },
};
