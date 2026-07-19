/**
 * Step 1：把用户的纹身描述 prompt 转化为纹身图案。
 *
 * 流程：
 *   1. 给原始 prompt 加 tattoo design 模板（白底 + 干净线条）
 *   2. 调 KIE gpt-image-2-text-to-image（aspect_ratio=1:1）
 *   3. 轮询任务直到完成
 *   4. 下载结果图并落到 R2（KIE 媒体只保留 14 天）
 *
 * 输出：TattooDesign { r2Key, r2Url }
 */
import { createTask, pollTask } from './kie-client'
import { fetchUrlAndUpload, makeOutputKey } from '@/lib/r2'
import type { TattooDesign } from './types'

/** 模型默认参数 */
const MODEL = 'gpt-image-2-text-to-image' as const
const ASPECT_RATIO = '1:1' as const

/** 给原始 prompt 加上纹身设计增强词 */
function buildPrompt(userPrompt: string): string {
  return (
    `${userPrompt}, tattoo design, white background, clean bold lines, ` +
    `high contrast, stencil style, professional tattoo flash`
  )
}

export interface GenerateTattooOptions {
  /** 用户的原始纹身描述，例如 "dragon japanese style" */
  prompt: string
  userId: string
  projectId: string
  /** 可选：轮询参数（测试时调短） */
  pollTimeoutMs?: number
}

/**
 * 生成纹身图案。
 * @throws Error 任何步骤失败（API Route 层会捕获并 refund credits）
 */
export async function generateTattooDesign(opts: GenerateTattooOptions): Promise<TattooDesign> {
  const { prompt: userPrompt, userId, projectId } = opts
  const enhancedPrompt = buildPrompt(userPrompt)

  // 1. 创建任务
  const taskId = await createTask({
    model: MODEL,
    input: {
      prompt: enhancedPrompt,
      aspect_ratio: ASPECT_RATIO,
    },
  })

  // 2. 轮询（gpt-image-2 实测 60-180 秒，给 240 秒保险）
  const result = await pollTask(taskId, {
    timeoutMs: opts.pollTimeoutMs ?? 240_000,
  })

  if (result.state !== 'success' || result.resultUrls.length === 0) {
    throw new Error(
      `generateTattooDesign: task ${taskId} ${result.state}, failMsg=${result.failMsg ?? 'no images'}`
    )
  }

  // 3. 下载到 R2
  const sourceUrl = result.resultUrls[0]
  const key = makeOutputKey(userId, projectId, 'png')
  const { publicUrl } = await fetchUrlAndUpload(sourceUrl, key)

  return { r2Key: key, r2Url: publicUrl }
}
