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
  '57014',
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
  'CONNECTION_DESTROYED',
  'UNDEFINED_VALUE',
  'UNSAFE_TRANSACTION',
  'SASL_SIGNATURE_MISMATCH',
  'COPY_IN_PROGRESS',
  'MAX_PARAMETERS_EXCEEDED',
  'NOT_TAGGED_CALL',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'ERR_SOCKET_CLOSED',
]);

// Only fixed classifications leave this function. Message text is inspected in
// memory because poolers sometimes omit structured codes; it is never logged.
const safeErrorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'PostgresError',
  'DrizzleQueryError',
  'APIError',
  'AggregateError',
]);
// Supabase poolers return XX000 for several unrelated failures. Keep only a
// fixed vocabulary, removing quoted values first; tenant names and credentials
// cannot be copied into logs. Never apply this to Drizzle's SQL wrapper message.
const poolerWords = new Set(
  'tenant or user not found circuit breaker open too many authentication errors connection connections database server client clients password invalid failed failure timeout timed out authentication query auth credentials session transaction mode pool pooler max limit reached ssl required is are was were has been closed unavailable queue request dropped from after milliseconds seconds connect connecting unable cannot could verify sasl signature missing cached plan must change result type internal error checkout no process overloaded shutdown shutting down'.split(
    ' '
  )
);

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
  ['cannot_read_property', /Cannot read propert(?:y|ies) (?:of|')/i],
  ['not_a_function', /is not a function/i],
  ['invalid_date', /Invalid (?:time value|date)/i],
  ['cookies_readonly', /Cookies can only be modified/i],
  ['outside_request_scope', /outside (?:a )?request scope/i],
  ['invalid_key', /invalid key|invalid (?:secret|public|private) key/i],
  [
    'query_cancelled',
    /cancel(?:ing|led|ed) (?:statement|query)|query (?:cancelled|canceled)/i,
  ],
];

// Never log raw messages/stacks: wrappers can contain full SQL and parameters,
// and auth/provider errors can contain credentials or user input.
export function reportServerFailure(
  operation:
    'auth.session' | 'auth.request' | 'auth.internal' | 'studio.request',
  error: unknown,
  requestId: string = randomUUID()
) {
  let databaseTarget:
    | { kind: string; port: string; max: number; customSizing: boolean }
    | undefined;
  try {
    const target = new URL(process.env.DATABASE_URL || '');
    databaseTarget = {
      kind: target.hostname.endsWith('.pooler.supabase.com')
        ? 'supabase-pooler'
        : 'postgres',
      port: target.port || '5432',
      max: Number(process.env.DB_MAX_CONNECTIONS) || 1,
      customSizing: process.env.DB_SINGLETON_ENABLED === 'true',
    };
  } catch {
    /* No URL, username or password is emitted. */
  }
  const codes = new Set<string>();
  const classifications = new Set<string>();
  const errorTypes = new Set<string>();
  const fields = new Set<string>();
  const locations = new Set<string>();
  const poolerSummaries = new Set<string>();
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
        name?: unknown;
        stack?: unknown;
        code?: unknown;
        cause?: unknown;
        message?: unknown;
        errors?: unknown;
      };
      // SQLSTATE is a public five-character protocol identifier, never a value.
      if (
        typeof value.code === 'string' &&
        (safeCodes.has(value.code) || /^[0-9A-Z]{5}$/.test(value.code))
      )
        codes.add(value.code);
      if (typeof value.name === 'string' && safeErrorTypes.has(value.name))
        errorTypes.add(value.name);
      if (typeof value.stack === 'string') {
        // Ignore the first line (the raw error message), local paths and all
        // function names/arguments. Emit only compiled Next chunk coordinates.
        for (const line of value.stack
          .slice(0, 16384)
          .split('\n')
          .slice(1, 21)) {
          if (!/^\s+at\s/.test(line)) continue;
          const match = line.match(
            /[\\/]\.next[\\/]server[\\/]chunks[\\/]((?:ssr[\\/])?[A-Za-z0-9_.\[\]-]{1,180}\.(?:js|mjs):\d{1,8}:\d{1,8})\)?$/
          );
          if (match && locations.size < 8)
            locations.add(
              `.next/server/chunks/${match[1].replaceAll('\\', '/')}`
            );
        }
      }
      message = value.message;
      if (value.code === 'XX000' && typeof message === 'string') {
        const words =
          message
            .slice(0, 2048)
            .replace(/'[^']*'|"[^"]*"|https?:\/\/\S+/g, ' ')
            .toLowerCase()
            .match(/[a-z]+/g) || [];
        poolerSummaries.add(
          words
            .slice(0, 60)
            .map((word) => (poolerWords.has(word) ? word : '_'))
            .join(' ')
        );
      }
      inspect(value.cause, depth + 1);
      if (Array.isArray(value.errors)) inspect(value.errors, depth + 1);
    }
    if (typeof message === 'string') {
      const bounded = message.slice(0, 8192);
      const field = bounded.match(
        /Cannot read properties of (?:undefined|null) \(reading '(headers|user|session|expiresAt|id)'\)/
      );
      if (field) fields.add(field[1]);
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
    errorTypes: [...errorTypes],
    fields: [...fields],
    locations: [...locations],
    poolerSummaries: [...poolerSummaries],
    databaseTarget,
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
