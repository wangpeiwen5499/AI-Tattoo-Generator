import { after } from 'next/server';
import {
  advanceTattooJob,
  recoverSubmittedTattooJob,
} from '@/server/ai/tattoo-jobs';
import { ensureTattooWorkflow } from '@/server/ai/tattoo-scheduler';
import { requireGenerationUser } from '@/server/auth/generation-access';
import { z } from 'zod';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

export const maxDuration = 60;
export async function POST(req: Request) {
  const access = await requireGenerationUser();
  if (access.response) return access.response;
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 10_000,
    keyPrefix: 'tattoo-recover',
    extraKey: access.user.id,
  });
  if (limited) return limited;
  const body = z
    .object({ projectId: z.uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!body.success)
    return Response.json({ error: 'Invalid project' }, { status: 400 });
  if (!(await recoverSubmittedTattooJob(body.data.projectId, access.user.id)))
    return Response.json(
      {
        error:
          'No saved provider results are available to recover, or this task is already active.',
      },
      { status: 409 }
    );
  after(async () => {
    try {
      await ensureTattooWorkflow(body.data.projectId);
    } catch {
      console.error('[tattoo-recovery] scheduling failed', body.data.projectId);
    }
    await advanceTattooJob(body.data.projectId);
  });
  return Response.json(
    { projectId: body.data.projectId },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
