export async function advanceGenerationStep(
  projectId: string
): Promise<boolean> {
  'use step';
  const { advanceTattooJob, getTattooJob } = await import('./tattoo-jobs');
  await advanceTattooJob(projectId);
  const job = await getTattooJob(projectId);
  return !!job && ['design', 'fusion', 'finalizing'].includes(job.stage);
}
