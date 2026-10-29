import { GET } from '@/app/api/internal/tattoo-jobs/route';
import { afterEach, expect, it, vi } from 'vitest';

const advance = vi.hoisted(() => vi.fn().mockResolvedValue(2));
vi.mock('@/server/ai/tattoo-jobs', () => ({ advanceDueTattooJobs: advance }));

afterEach(() => {
  vi.unstubAllEnvs();
  advance.mockClear();
});
it('rejects missing, incorrect and non-ASCII scheduler credentials without executing jobs', async () => {
  vi.stubEnv('CRON_SECRET', 'a'.repeat(32));
  for (const authorization of [
    '',
    `Bearer ${'b'.repeat(32)}`,
    `Bearer ${'é'.repeat(32)}`,
  ]) {
    expect(
      (
        await GET(
          new Request('https://local/api/internal/tattoo-jobs', {
            headers: { authorization },
          })
        )
      ).status
    ).toBe(401);
  }
  expect(advance).not.toHaveBeenCalled();
});
it('advances due jobs with valid credentials', async () => {
  vi.stubEnv('CRON_SECRET', 'a'.repeat(32));
  const response = await GET(
    new Request('https://local/api/internal/tattoo-jobs', {
      headers: { authorization: `Bearer ${'a'.repeat(32)}` },
    })
  );
  expect(await response.json()).toEqual({ advanced: 2 });
});
