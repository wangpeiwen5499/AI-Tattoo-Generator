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
import { NextResponse } from 'next/server';

import { getSignUser } from '@/shared/models/user';
import { getProjectWithGenerations } from '@/server/db/tattoo-queries';
import { getPublicUrl } from '@/lib/r2';
import { BODY_PARTS, type BodyPart } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  const user = await getSignUser();
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = new URL(req.url).searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  const project = await getProjectWithGenerations(id);
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const tattooDesignUrl = project.tattooDesignUrl
    ?? (project.tattooDesignKey ? getPublicUrl(project.tattooDesignKey) : null);

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

  return NextResponse.json({
    status: project.status,
    tattooDesignUrl,
    images,
  });
}
