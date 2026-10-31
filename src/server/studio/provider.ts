import type { KieCreateTaskBody, KieRecordInfoData } from '@/server/ai/types';

import { getAllConfigs } from '@/shared/models/config';

import { assertStudioProduction, StudioError } from './policy';

async function request(path: string, body?: KieCreateTaskBody) {
  assertStudioProduction();
  const configs = await getAllConfigs();
  const key = process.env.KIE_API_KEY || configs.kie_api_key;
  if (!key) throw new StudioError('Studio provider is not configured', 503);
  const response = await fetch(`https://api.kie.ai/api/v1/jobs/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok || data.code !== 200 || !data.data)
    throw new Error('Provider request was not confirmed');
  return data.data;
}
export async function createTask(body: KieCreateTaskBody): Promise<string> {
  const data = await request('createTask', body);
  if (
    typeof data.taskId !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,180}$/.test(data.taskId)
  )
    throw new Error('Provider request was not confirmed');
  return data.taskId;
}
export async function getRecordInfo(
  taskId: string
): Promise<KieRecordInfoData> {
  return request(`recordInfo?taskId=${encodeURIComponent(taskId)}`);
}
