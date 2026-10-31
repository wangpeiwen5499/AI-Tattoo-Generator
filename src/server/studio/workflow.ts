import { sleep } from 'workflow';

import { advanceStudioStep } from './step';

export async function studioWorkflow(id: string) {
  'use workflow';
  while (await advanceStudioStep(id)) await sleep('5s');
}
