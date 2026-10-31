import { after } from 'next/server';
import { readBoundedBody } from '@/server/storage/file-proxy';
import {
  assertStudioProduction,
  sameOrigin,
  StudioError,
} from '@/server/studio/policy';
import { resolveStudioReview } from '@/server/studio/recovery';
import { ensureStudioWorkflow } from '@/server/studio/scheduler';

import { getSignUser } from '@/shared/models/user';
import { hasPermission } from '@/shared/services/rbac';

export async function POST(request: Request) {
  try {
    assertStudioProduction();
    sameOrigin(request);
    const admin = await getSignUser();
    if (!admin) throw new StudioError('Sign in required', 401);
    if (
      !(await hasPermission(admin.id, 'admin.access')) ||
      !(await hasPermission(admin.id, 'admin.credits.write'))
    )
      throw new StudioError('Permission denied', 403);
    const input = JSON.parse(
      Buffer.from(await readBoundedBody(request, 4096)).toString()
    );
    if (
      !['attach', 'refund'].includes(input.action) ||
      typeof input.task !== 'string'
    )
      throw new StudioError('Invalid review action');
    const job = await resolveStudioReview(
      admin.id,
      input.task,
      input.action,
      input.providerTaskId
    );
    if (job.state === 'running' || job.state === 'storing')
      after(() => ensureStudioWorkflow(job.id).catch(() => {}));
    return Response.json(
      { task: job.id, state: job.state, refunded: job.refunded },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof StudioError
            ? error.message
            : 'Review action could not be completed',
      },
      { status: error instanceof StudioError ? error.status : 503 }
    );
  }
}
