/**
 * Step 1：把用户的纹身描述 prompt 转化为纹身图案（从 Demo 迁入 ShipAny Two）。
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

const MODEL = 'gpt-image-2-text-to-image' as const
const ASPECT_RATIO = '1:1' as const

function buildPrompt(userPrompt: string): string {
  return (
    `${userPrompt}, tattoo design, white background, clean bold lines, ` +
    `high contrast, stencil style, professional tattoo flash`
  )
}

export interface GenerateTattooOptions {
  prompt: string
  userId: string
  projectId: string
  pollTimeoutMs?: number
}

export async function generateTattooDesign(opts: GenerateTattooOptions): Promise<TattooDesign> {
  const { prompt: userPrompt, userId, projectId } = opts
  const enhancedPrompt = buildPrompt(userPrompt)

  const taskId = await createTask({
    model: MODEL,
    input: {
      prompt: enhancedPrompt,
      aspect_ratio: ASPECT_RATIO,
    },
  })

  const result = await pollTask(taskId, {
    timeoutMs: opts.pollTimeoutMs ?? 240_000,
  })

  if (result.state !== 'success' || result.resultUrls.length === 0) {
    throw new Error(
      `generateTattooDesign: task ${taskId} ${result.state}, failMsg=${result.failMsg ?? 'no images'}`
    )
  }

  const sourceUrl = result.resultUrls[0]
  const key = makeOutputKey(userId, projectId, 'png')
  const { publicUrl } = await fetchUrlAndUpload(sourceUrl, key)

  return { r2Key: key, r2Url: publicUrl }
}
