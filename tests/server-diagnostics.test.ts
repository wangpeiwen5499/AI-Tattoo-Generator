import { reportServerFailure } from '@/server/diagnostics';
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
