import { randomUUID } from 'node:crypto';
import { validateUploadedPhoto } from '@/lib/r2';
import { TATTOO_RESOLUTIONS } from '@/lib/tattoo-resolution';
import {
  failUnstartedTattooJob,
  GenerationRequestError,
  startTattooGeneration,
} from '@/server/ai/tattoo-jobs';
import { ensureTattooWorkflow } from '@/server/ai/tattoo-scheduler';
import { requireGenerationUser } from '@/server/auth/generation-access';
import { z } from 'zod';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const requestSchema = z.object({
  bodyPhotoKey: z.string().max(250),
  prompt: z.string().trim().min(1).max(500),
  requestId: z.uuid().optional(),
  resolution: z.enum(TATTOO_RESOLUTIONS).default('1K'),
});

export async function POST(req: Request): Promise<Response> {
  const access = await requireGenerationUser();
  if (access.response) return access.response;
  const actor = { type: 'user' as const, id: access.user.id };
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 1500,
    keyPrefix: 'tattoo-start',
    extraKey: actor.id,
  });
  if (limited) return limited;
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { error: 'Invalid photo, prompt or resolution' },
      { status: 400 }
    );
  try {
    await validateUploadedPhoto(parsed.data.bodyPhotoKey, actor.id);
  } catch {
    return Response.json(
      { error: 'Photo is invalid or unavailable. Please upload it again.' },
      { status: 400 }
    );
  }
  try {
    const projectId = await startTattooGeneration({
      actor,
      bodyPhotoKey: parsed.data.bodyPhotoKey,
      prompt: parsed.data.prompt,
      resolution: parsed.data.resolution,
      requestId: parsed.data.requestId || randomUUID(),
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });
    try {
      await ensureTattooWorkflow(projectId);
    } catch {
      console.error('[tattoo-start] background scheduling failed', projectId);
      if (await failUnstartedTattooJob(projectId))
        return Response.json(
          {
            projectId,
            error:
              'Unable to start background generation. The generation charge has been reversed.',
          },
          { status: 503 }
        );
      // A run whose acknowledgement was lost may already be executing. Return its saved project.
    }
    return Response.json(
      { projectId },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof GenerationRequestError)
      return Response.json({ error: error.message }, { status: error.status });
    console.error('[tattoo-start] Failed to create generation', error);
    return Response.json(
      { error: 'Unable to start generation. Please try again.' },
      { status: 500 }
    );
  }
}
