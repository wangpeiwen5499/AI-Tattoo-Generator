/**
 * 纹身业务数据库查询（Drizzle ORM，适配 ShipAny Two）。
 */
import { eq, desc } from 'drizzle-orm';

import { db } from '@/core/db';
import { tattooProject, tattooGeneration } from '@/config/db/schema';
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
  status: string;
  tattooDesignKey: string | null;
  tattooDesignUrl: string | null;
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
    status: project[0].status,
    tattooDesignKey: project[0].tattooDesignKey,
    tattooDesignUrl: project[0].tattooDesignUrl,
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
export async function listUserTattooProjects(userId: string): Promise<
  Array<{
    id: string;
    prompt: string;
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
  const projects = await db()
    .select()
    .from(tattooProject)
    .where(eq(tattooProject.userId, userId))
    .orderBy(desc(tattooProject.createdAt));

  const result = await Promise.all(
    projects.map(async (p) => {
      const gens = await db()
        .select()
        .from(tattooGeneration)
        .where(eq(tattooGeneration.projectId, p.id));

      return {
        id: p.id,
        prompt: p.prompt,
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
