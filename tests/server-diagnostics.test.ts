import { reportServerFailure, safeAuthLogger } from '@/server/diagnostics';
import { createLogger } from '@better-auth/core/env';
import { expect, it, vi } from 'vitest';

it('captures standard SQLSTATE and nested aggregate driver errors without copying payloads', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  reportServerFailure(
    'auth.internal',
    new Error('private SQL', {
      cause: new AggregateError([
        Object.assign(new Error('private query'), { code: 'XX000' }),
        Object.assign(new Error('private parameter'), {
          code: 'UNDEFINED_VALUE',
        }),
      ]),
    })
  );
  const text = JSON.stringify(log.mock.calls);
  expect(text).toContain('XX000');
  expect(text).toContain('UNDEFINED_VALUE');
  expect(text).not.toContain('private');
  log.mockRestore();
});

it('logs only allowlisted metadata, including nested driver codes', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = Object.assign(
    new Error('secret SQL prompt cookie postgres://password'),
    {
      cause: Object.assign(new Error('private query'), { code: '53300' }),
    }
  );
  reportServerFailure('auth.session', error, 'request-123');
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain('53300');
  expect(output).toContain('request-123');
  expect(output).not.toMatch(/secret|password|private query|cookie/);
  log.mockRestore();
});
it('rejects arbitrary code/name values rather than copying private strings', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  reportServerFailure('studio.request', {
    name: 'private name',
    code: 'secret',
  });
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/private name|secret/);
  log.mockRestore();
});

it('captures underlying Better Auth session failures before APIError discards the cause', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const logger = createLogger(safeAuthLogger);
  const driverError = Object.assign(
    new Error('MaxClientsInSessionMode postgres://private-token'),
    { code: '08P01' }
  );
  logger.error(
    'INTERNAL_SERVER_ERROR private cookie',
    Object.assign(
      new Error('Failed query: select private_email from session'),
      { cause: driverError }
    )
  );
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain('08P01');
  expect(output).toContain('pooler_session_limit');
  expect(output).not.toMatch(/private|cookie|select|postgres:/);
  expect(log).toHaveBeenCalledTimes(1);
  log.mockRestore();
});
it('suppresses non-error Better Auth logs and never copies message-only errors', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const logger = createLogger(safeAuthLogger);
  logger.warn('secret warning', new Error('secret'));
  logger.info('secret info');
  expect(log).not.toHaveBeenCalled();
  logger.error('secret access token');
  expect(log).toHaveBeenCalledOnce();
  expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret|token/);
  log.mockRestore();
});
it.each([
  ['too many connections for role private', 'connection_limit'],
  ['invalid input syntax for type uuid: private', 'invalid_uuid'],
  ['fetch failed: private', 'network_failure'],
  ['connection timeout private', 'timeout'],
  ['column private does not exist', 'missing_column'],
])(
  'classifies known failure patterns without copying their values',
  (message, classification) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    reportServerFailure('auth.session', new Error(message));
    expect(JSON.stringify(log.mock.calls)).toContain(classification);
    expect(JSON.stringify(log.mock.calls)).not.toContain('private');
    log.mockRestore();
  }
);
it('records only allowlisted error types, static fields, and compiled stack locations', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new TypeError(
    "Cannot read properties of undefined (reading 'session') private-token"
  );
  error.stack =
    'TypeError: secret .next/server/chunks/leak.js:1:2\n    at privateFunction (/var/task/.next/server/chunks/1234.js:51:22)\n    at secret (/var/task/.next/server/chunks/ssr/[root-of-server]__abc._.js:7:8)\n    at privateFn(secretArgument)\n    at secret (/var/task/source/private-token.ts:1:2)';
  reportServerFailure('auth.internal', error);
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain('TypeError');
  expect(output).toContain('cannot_read_property');
  expect(output).toContain('session');
  expect(output).toContain('.next/server/chunks/1234.js:51:22');
  expect(output).toContain(
    '.next/server/chunks/ssr/[root-of-server]__abc._.js:7:8'
  );
  expect(output).not.toMatch(/private|secret|leak|var\/task|source|Function/);
  log.mockRestore();
});
it.each([
  ['value.private is not a function', 'not_a_function'],
  ['Invalid time value private', 'invalid_date'],
  [
    'Cookies can only be modified in a Server Action private',
    'cookies_readonly',
  ],
  [
    'headers was called outside a request scope private',
    'outside_request_scope',
  ],
  ['Invalid key length private', 'invalid_key'],
  ['canceling statement due to user request private', 'query_cancelled'],
])('classifies application failures safely', (message, classification) => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  reportServerFailure('auth.internal', new Error(message));
  expect(JSON.stringify(log.mock.calls)).toContain(classification);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  log.mockRestore();
});
