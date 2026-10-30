import { GET } from '@/app/api/ai/generate-tattoo/status/route';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  actor: vi.fn(),
  project: vi.fn(),
  job: vi.fn(),
  ensure: vi.fn(),
  advance: vi.fn(),
  after: vi.fn(),
}));
vi.mock('next/server', async (original) => ({
  ...(await original<any>()),
  after: mocks.after,
}));
vi.mock('@/server/auth/actor', () => ({ getActor: mocks.actor }));
vi.mock('@/server/db/tattoo-queries', () => ({
  getProjectWithGenerations: mocks.project,
}));
vi.mock('@/server/ai/tattoo-scheduler', () => ({
  ensureTattooWorkflow: mocks.ensure,
}));
vi.mock('@/server/ai/tattoo-jobs', () => ({
  getTattooJob: mocks.job,
  getActiveTattooJob: vi.fn(),
  advanceTattooJob: mocks.advance,
}));
vi.mock('@/lib/r2', () => ({ getPublicUrl: (key: string) => key }));

afterEach(() => vi.clearAllMocks());
it('returns saved partial body results and ensures background scheduling without doing provider work inside a browser poll', async () => {
  mocks.actor.mockResolvedValue({ id: 'owner', type: 'user' });
  mocks.project.mockResolvedValue({
    userId: 'owner',
    status: 'processing',
    createdAt: new Date(),
    generations: [],
    resolution: '2K',
    creditsCost: 2,
    tattooDesignUrl: 'https://files.example/design.png',
  });
  mocks.job.mockResolvedValue({
    stage: 'fusion',
    expiresAt: new Date(Date.now() + 100000),
    tasks: JSON.stringify([
      {
        bodyPart: 'left_arm',
        status: 'completed',
        r2Url: 'https://files.example/arm.png',
      },
      { bodyPart: 'right_arm', status: 'running' },
    ]),
  });
  const response = await GET(
    new Request('https://local/api/ai/generate-tattoo/status?id=project')
  );
  const data = await response.json();
  expect(data.images).toHaveLength(4);
  expect(data.completedParts).toBe(1);
  expect(data.images[0]).toMatchObject({
    status: 'completed',
    url: 'https://files.example/arm.png',
  });
  await mocks.after.mock.calls[0][0]();
  expect(mocks.ensure).toHaveBeenCalledWith('project');
  expect(mocks.advance).not.toHaveBeenCalled();
});
it('rejects another user before scheduling work or exposing images', async () => {
  mocks.actor.mockResolvedValue({ id: 'other', type: 'user' });
  mocks.project.mockResolvedValue({ userId: 'owner' });
  const response = await GET(
    new Request('https://local/api/ai/generate-tattoo/status?id=project')
  );
  expect(response.status).toBe(404);
  expect(mocks.after).not.toHaveBeenCalled();
});
