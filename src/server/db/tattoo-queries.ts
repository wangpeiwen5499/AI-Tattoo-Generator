/**
 * 纹身业务数据库查询（Drizzle ORM，适配 ShipAny Two）。
 */
import { count, desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/core/db';
import { tattooGeneration, tattooProject } from '@/config/db/schema';
import { getUuid } from '@/shared/lib/hash';

/** 创建生成项目记录 */
export async function createTattooProject(params: {
  userId: string;
  prompt: string;
  bodyPhotoKey: string;
  bodyPhotoUrl: string;
}): Promise<string> {
  const id = getUuid();
  await db().insert(tattooProject).values({
    id,
    userId: params.userId,
    prompt: params.prompt,
    bodyPhotoKey: params.bodyPhotoKey,
    bodyPhotoUrl: params.bodyPhotoUrl,
    status: 'processing',
  });
  return id;
}

/** 记录单条生成结果 */
export async function recordTattooGeneration(params: {
  projectId: string;
  bodyPart: string;
  r2Key: string | null;
  r2Url: string | null;
  status: 'completed' | 'failed';
  error: string | null;
}): Promise<void> {
  await db().insert(tattooGeneration).values({
    id: getUuid(),
    projectId: params.projectId,
    bodyPart: params.bodyPart,
    r2Key: params.r2Key,
    r2Url: params.r2Url,
    status: params.status,
    error: params.error,
  });
}

/** 更新项目状态 */
export async function updateTattooProjectStatus(
  projectId: string,
  status: 'completed' | 'failed'
): Promise<void> {
  await db()
    .update(tattooProject)
    .set({ status })
    .where(eq(tattooProject.id, projectId));
}

/** 更新项目的纹身设计图信息（Step 1 完成后） */
export async function updateTattooProjectDesign(
  projectId: string,
  designKey: string,
  designUrl: string
): Promise<void> {
  await db()
    .update(tattooProject)
    .set({ tattooDesignKey: designKey, tattooDesignUrl: designUrl })
    .where(eq(tattooProject.id, projectId));
}

/** 查询项目及其所有 generation（用于状态轮询和详情页） */
export async function getProjectWithGenerations(projectId: string): Promise<{
  id: string;
  userId: string;
  prompt: string;
  resolution: string;
  creditsCost: number;
  status: string;
  tattooDesignKey: string | null;
  tattooDesignUrl: string | null;
  bodyPhotoKey: string | null;
  bodyPhotoUrl: string;
  createdAt: Date;
  generations: Array<{
    bodyPart: string;
    status: string;
    r2Key: string | null;
    r2Url: string | null;
  }>;
} | null> {
  const project = await db()
    .select()
    .from(tattooProject)
    .where(eq(tattooProject.id, projectId))
    .limit(1);

  if (!project.length) return null;

  const gens = await db()
    .select()
    .from(tattooGeneration)
    .where(eq(tattooGeneration.projectId, projectId));

  return {
    id: project[0].id,
    userId: project[0].userId,
    prompt: project[0].prompt,
    resolution: project[0].resolution,
    creditsCost: project[0].creditsCost,
    status: project[0].status,
    tattooDesignKey: project[0].tattooDesignKey,
    tattooDesignUrl: project[0].tattooDesignUrl,
    bodyPhotoKey: project[0].bodyPhotoKey,
    bodyPhotoUrl: project[0].bodyPhotoUrl,
    createdAt: project[0].createdAt,
    generations: gens.map((g) => ({
      bodyPart: g.bodyPart,
      status: g.status,
      r2Key: g.r2Key,
      r2Url: g.r2Url,
    })),
  };
}

/** 查询用户所有已完成的项目（用于历史记录页） */
export async function listUserTattooProjects(
  userId: string,
  options: { page?: number; limit?: number } = {}
): Promise<
  Array<{
    id: string;
    prompt: string;
    resolution: string;
    creditsCost: number;
    status: string;
    tattooDesignUrl: string | null;
    createdAt: Date;
    generations: Array<{
      bodyPart: string;
      status: string;
      r2Url: string | null;
    }>;
  }>
> {
  const limit = Math.min(50, Math.max(1, Math.floor(options.limit || 20)));
  const page = Math.min(100000, Math.max(1, Math.floor(options.page || 1)));
  const projects = await db()
    .select()
    .from(tattooProject)
    .where(eq(tattooProject.userId, userId))
    .orderBy(desc(tattooProject.createdAt), desc(tattooProject.id))
    .limit(limit)
    .offset((page - 1) * limit);

  if (!projects.length) return [];
  const generations = await db()
    .select()
    .from(tattooGeneration)
    .where(
      inArray(
        tattooGeneration.projectId,
        projects.map((project) => project.id)
      )
    );

  const result = await Promise.all(
    projects.map(async (p) => {
      const gens = generations.filter(
        (generation) => generation.projectId === p.id
      );

      return {
        id: p.id,
        prompt: p.prompt,
        resolution: p.resolution,
        creditsCost: p.creditsCost,
        status: p.status,
        tattooDesignUrl: p.tattooDesignUrl,
        createdAt: p.createdAt,
        generations: gens.map((g) => ({
          bodyPart: g.bodyPart,
          status: g.status,
          r2Url: g.r2Url,
        })),
      };
    })
  );

  return result;
}

export async function countUserTattooProjects(userId: string): Promise<number> {
  const [result] = await db()
    .select({ value: count() })
    .from(tattooProject)
    .where(eq(tattooProject.userId, userId));
  return result?.value || 0;
}
