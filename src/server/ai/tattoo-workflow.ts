import { sleep } from 'workflow';

import { advanceGenerationStep } from './tattoo-step';

export async function tattooGenerationWorkflow(projectId: string) {
  'use workflow';
  console.log('[tattoo-workflow] started', projectId);
  while (await advanceGenerationStep(projectId)) {
    await sleep('5s');
  }
  console.log('[tattoo-workflow] settled', projectId);
}
