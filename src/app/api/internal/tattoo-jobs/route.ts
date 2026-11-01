import { timingSafeEqual } from 'node:crypto';
import { advanceDueTattooJobs } from '@/server/ai/tattoo-jobs';
import { advanceDueStudioJobs } from '@/server/studio/runner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Configure a scheduler to call this endpoint with Authorization: Bearer <CRON_SECRET>.
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const advanced = await advanceDueTattooJobs();
  const studioAdvanced = await advanceDueStudioJobs();
  return Response.json(
    { advanced, studioAdvanced },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
