import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { validateUploadedPhoto } from '@/lib/r2';
import {
  advanceTattooJob,
  GenerationRequestError,
  startTattooGeneration,
} from '@/server/ai/tattoo-jobs';
import { getActor } from '@/server/auth/actor';
import { z } from 'zod';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const requestSchema = z.object({
  bodyPhotoKey: z.string().max(250),
  prompt: z.string().trim().min(1).max(500),
  requestId: z.uuid().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor)
    return Response.json(
      { error: 'Please upload your photo again to start a secure session.' },
      { status: 401 }
    );
  const limited = enforceMinIntervalRateLimit(req, {
    intervalMs: 1500,
    keyPrefix: 'tattoo-start',
    extraKey: actor.id,
  });
  if (limited) return limited;
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: 'Invalid photo or prompt' }, { status: 400 });
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
      requestId: parsed.data.requestId || randomUUID(),
      ip:
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });
    after(() => advanceTattooJob(projectId));
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
