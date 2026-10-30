import { tattooGenerationWorkflow } from '@/server/ai/tattoo-workflow';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ step: vi.fn(), sleep: vi.fn() }));
vi.mock('workflow', () => ({ sleep: mocks.sleep }));
vi.mock('@/server/ai/tattoo-step', () => ({
  advanceGenerationStep: mocks.step,
}));

it('advances and durably sleeps until settlement without any browser request', async () => {
  mocks.step
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);
  await tattooGenerationWorkflow('project');
  expect(mocks.step).toHaveBeenCalledTimes(3);
  expect(mocks.sleep).toHaveBeenCalledTimes(2);
  expect(mocks.sleep).toHaveBeenCalledWith('5s');
});
