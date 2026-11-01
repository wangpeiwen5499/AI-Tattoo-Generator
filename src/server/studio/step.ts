export async function advanceStudioStep(id: string): Promise<boolean> {
  'use step';
  const { advanceStudioJob, ACTIVE } = await import('./service');
  const { db } = await import('@/core/db');
  const { studioJob } = await import('@/config/db/schema');
  const { eq } = await import('drizzle-orm');
  await advanceStudioJob(id);
  const [job] = await db()
    .select({ state: studioJob.state })
    .from(studioJob)
    .where(eq(studioJob.id, id));
  return !!job && ACTIVE.includes(job.state);
}
