import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { readBoundedBody } from '@/server/storage/file-proxy';
import { proxyAsset, uploadAsset } from '@/server/studio/assets';
import {
  accountStudioAllowed,
  assertAccountStudio,
  MAX_UPLOAD_BYTES,
  sameOrigin,
  studioConfigured,
  StudioError,
} from '@/server/studio/policy';
import { ensureStudioWorkflow } from '@/server/studio/scheduler';
import {
  ACTIVE,
  advanceStudioJob,
  getStudioJob,
  removeStudioRecord,
  startStudioJob,
  studioCollection,
} from '@/server/studio/service';
import { and, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { studioJob, studioRecord } from '@/config/db/schema';
import { getRemainingCredits } from '@/shared/models/credit';
import { getSignUser } from '@/shared/models/user';

export const runtime = 'nodejs';
export const maxDuration = 90;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
async function handle(request: Request) {
  const url = new URL(request.url),
    mutation = request.method !== 'GET';
  if (mutation) sameOrigin(request);
  // Account mode runs in production or in a Preview deployment whose owner has
  // certified isolation via PREVIEW_STUDIO_ISOLATED=1. Otherwise every account
  // surface reports itself explicitly unavailable — it never falls back to
  // browser-local storage or simulated credits.
  if (!accountStudioAllowed()) {
    if (!mutation && !url.search)
      return json({
        mode: 'account',
        configured: false,
        reason: 'isolation',
        signedIn: false,
        verified: false,
        credits: 0,
        resolutions: ['1K', '2K', '4K'],
        pending: [],
      });
    assertAccountStudio();
  }
  const owner = await getSignUser();
  const mode = url.searchParams.get('mode'),
    collection = url.searchParams.get('collection'),
    asset = url.searchParams.get('asset');
  if (!mutation && !collection && !asset) {
    const pending = owner
      ? await db()
          .select()
          .from(studioJob)
          .where(
            and(
              eq(studioJob.userId, owner.id),
              inArray(studioJob.state, [...ACTIVE, 'review_required'])
            )
          )
      : [];
    if (owner && pending.some((j) => ACTIVE.includes(j.state)))
      after(async () => {
        for (const job of pending.filter((j) => ACTIVE.includes(j.state))) {
          await ensureStudioWorkflow(job.id).catch(() => {});
          await advanceStudioJob(job.id).catch(() => {});
        }
      });
    const configured = await studioConfigured().catch(() => false);
    return json({
      mode: 'account',
      configured,
      ...(configured ? {} : { reason: 'configuration' }),
      signedIn: !!owner,
      verified: !!owner?.emailVerified,
      userId: owner?.id,
      credits: owner ? await getRemainingCredits(owner.id) : 0,
      resolutions: ['1K', '2K', '4K'],
      pending: pending.map((j) => ({
        task: j.id,
        kind: j.kind,
        operationId: j.operationId,
        prompt: JSON.parse(j.input).prompt || '',
        resolution: j.resolution,
        state: j.state,
      })),
    });
  }
  if (!owner) throw new StudioError('Sign in to use your studio library.', 401);
  if (!mutation) {
    if (asset) return proxyAsset(owner.id, asset);
    if (collection)
      return json({ records: await studioCollection(owner.id, collection) });
  }
  if (request.method === 'DELETE') {
    await removeStudioRecord(
      owner.id,
      collection || '',
      url.searchParams.get('id') || ''
    );
    return json({ ok: true });
  }
  if (request.method !== 'POST')
    throw new StudioError('Unsupported method', 405);
  if (mode === 'upload' || mode === 'save-design') {
    if (!owner.emailVerified)
      throw new StudioError('Verify your email before uploading images.', 403);
    // Bound the entire multipart stream before parsing; Content-Length alone is untrusted.
    const bytes = await readBoundedBody(request, MAX_UPLOAD_BYTES + 64 * 1024);
    const form = await new Request(request.url, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') || '' },
      body: Buffer.from(bytes),
    }).formData();
    const file = form.get('image');
    if (!(file instanceof File)) throw new StudioError('Image is required');
    const image = await uploadAsset(owner.id, file);
    if (mode === 'upload') return json({ asset: image });
    const field = (name: string, max: number) =>
      String(form.get(name) || '')
        .trim()
        .slice(0, max);
    const [record] = await db()
      .insert(studioRecord)
      .values({
        id: randomUUID(),
        userId: owner.id,
        collection: 'designs',
        image,
        name: field('name', 120),
        prompt: field('prompt', 1000),
        source: field('source', 40) || 'uploaded',
      })
      .returning();
    return json({ record });
  }
  const bytes = await readBoundedBody(request, 16 * 1024);
  let input: any;
  try {
    input = JSON.parse(Buffer.from(bytes).toString('utf8'));
  } catch {
    throw new StudioError('Invalid request');
  }
  if (mode === 'design' || mode === 'render') {
    if (!(await studioConfigured()))
      throw new StudioError('Studio service is not configured', 503);
    const task = await startStudioJob(owner.id, mode, input);
    after(async () => {
      await ensureStudioWorkflow(task).catch(() => {});
      await advanceStudioJob(task).catch(() => {});
    });
    return json({ task });
  }
  if (mode === 'status') {
    // Ownership lookup precedes any advancement/provider call.
    await getStudioJob(owner.id, input.task);
    await advanceStudioJob(input.task);
    const job = await getStudioJob(owner.id, input.task);
    if (ACTIVE.includes(job.state))
      after(() => ensureStudioWorkflow(job.id).catch(() => {}));
    const saved = JSON.parse(job.input);
    return json({
      state: job.state,
      failed: job.state === 'failed',
      error: job.error || undefined,
      asset: job.assetId || undefined,
      operationId: job.operationId,
      kind: job.kind,
      designId:
        job.kind === 'design' ? job.recordId || undefined : saved.designId,
      historyId: job.kind === 'render' ? job.recordId || undefined : undefined,
    });
  }
  throw new StudioError('Unsupported request');
}
async function route(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof StudioError)
      return json({ error: error.message }, error.status);
    if (error instanceof Error && error.message === 'File too large')
      return json({ error: 'File too large' }, 413);
    return json(
      {
        error:
          'Studio service is temporarily unavailable. Your saved work is retained.',
      },
      503
    );
  }
}
export { route as GET, route as POST, route as DELETE };
