import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectWithGenerations } from '@/server/db/queries'
import { getPublicUrl } from '@/lib/r2'
import { BODY_PARTS, type BodyPart } from '@/lib/constants'
import type { GenerateImage } from '@/types'

// 轮询接口必须每次都打到动态函数，禁用一切静态化/缓存
export const dynamic = 'force-dynamic'

/**
 * GET /api/generate/status?id=<projectId>
 * 前端轮询生成进度。响应：
 *   {
 *     status: 'processing' | 'completed' | 'failed',
 *     tattooDesignUrl: string | null,   // Step1 成功后从 generations[0].tattoo_image_key 还原
 *     images: [{ bodyPart, status, url }],  // 按 BODY_PARTS 原顺序
 *     error: string | null              // failed 时有值
 *   }
 *
 * 状态码：200 正常；401 未登录；400 缺 id；404 project 不存在或不属于该用户。
 */
export async function GET(req: Request): Promise<Response> {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const project = await getProjectWithGenerations(id)
  if (!project || project.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Step1 纹身图 URL 从 generations[0].tattoo_image_key 还原
  // （Step1 失败 → runGeneration 进 catch、未 recordGenerations → generations 为空 → null）
  const tattooImageKey = project.generations[0]?.tattoo_image_key ?? null
  const tattooDesignUrl = tattooImageKey ? getPublicUrl(tattooImageKey) : null

  // generations 按 BODY_PARTS 原顺序排列，保证前端 2x2 网格稳定
  const sortedGenerations = [...project.generations].sort(
    (a, b) =>
      BODY_PARTS.indexOf(a.body_part as BodyPart) -
      BODY_PARTS.indexOf(b.body_part as BodyPart)
  )

  const images: GenerateImage[] = sortedGenerations.map((g) => ({
    bodyPart: g.body_part as BodyPart,
    status: g.status as 'completed' | 'failed',
    url: g.result_image_url,
  }))

  return NextResponse.json({
    status: project.status,
    tattooDesignUrl,
    images,
    error: project.error_message,
  })
}
