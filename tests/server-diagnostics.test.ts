import { reportServerFailure, safeAuthLogger } from '@/server/diagnostics';
import { createLogger } from '@better-auth/core/env';
import { expect, it, vi } from 'vitest';

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
