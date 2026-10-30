/**
 * GET /api/ai/generate-tattoo/status?id=<projectId>
 *
 * 前端轮询生成进度。响应：
 *   {
 *     status: 'processing' | 'completed' | 'failed',
 *     tattooDesignUrl: string | null,
 *     images: [{ bodyPart, status, url }],
 *     error: string | null
 *   }
 */
import { after, NextResponse } from 'next/server';
import { BODY_PARTS, type BodyPart } from '@/lib/constants';
import { getPublicUrl } from '@/lib/r2';
import {
  advanceTattooJob,
  getActiveTattooJob,
  getTattooJob,
} from '@/server/ai/tattoo-jobs';
import { getActor } from '@/server/auth/actor';
import { getProjectWithGenerations } from '@/server/db/tattoo-queries';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request): Promise<Response> {
  const actor = await getActor();
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id =
    new URL(req.url).searchParams.get('id') ||
    (await getActiveTattooJob(actor.id))?.projectId;
  if (!id) {
    return new Response(null, {
      status: 204,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  }

  const project = await getProjectWithGenerations(id);
  if (!project || project.userId !== actor.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const tattooDesignUrl =
    project.tattooDesignUrl ??
    (project.tattooDesignKey ? getPublicUrl(project.tattooDesignKey) : null);

  const sortedGenerations = [...project.generations].sort(
    (a, b) =>
      BODY_PARTS.indexOf(a.bodyPart as BodyPart) -
      BODY_PARTS.indexOf(b.bodyPart as BodyPart)
  );

  const images = sortedGenerations.map((g) => ({
    bodyPart: g.bodyPart,
    status: g.status as 'completed' | 'failed',
    url: g.r2Url,
  }));

  const job = await getTattooJob(id);
  if (actor.type === 'user' && job && project.status === 'processing')
    after(() => advanceTattooJob(id));

  return NextResponse.json(
    {
      projectId: id,
      resolution: project.resolution,
      creditsCost: project.creditsCost,
      expiresAt: job?.expiresAt.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      status: project.status,
      tattooDesignUrl,
      images,
      refunded: job?.refunded ?? false,
      stage: job?.stage ?? project.status,
      completedParts: job
        ? JSON.parse(job.tasks).filter(
            (task: { status: string }) => task.status === 'completed'
          ).length
        : images.filter((image) => image.status === 'completed').length,
      error: job?.error ?? null,
    },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
}
