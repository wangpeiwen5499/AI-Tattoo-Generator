/**
 * Step 2：把纹身图案融合到身体照片的 4 个部位（从 Demo 迁入 ShipAny Two）。
 *
 * 流程：
 *   1. 对 4 个部位（left_arm / right_arm / shoulder / calf）并发创建任务
 *   2. 并发轮询所有任务（pollManyTasks）
 *   3. 每个成功的任务把图片下载到 R2
 *   4. 单个部位失败不影响其他（用 Promise.allSettled 语义）
 */
import { BODY_PARTS, BODY_PART_LABELS, type BodyPart } from '@/lib/constants'
import { createTask, pollManyTasks } from './kie-client'
import { fetchUrlAndUpload, makeOutputKey } from '@/lib/r2'
import type { BodyFusionResults, BodyPartResult, StoredImage } from './types'

const MODEL = 'gpt-image-2-image-to-image' as const
const ASPECT_RATIO = '3:4' as const

function buildPrompt(bodyPart: BodyPart): string {
  const label = BODY_PART_LABELS[bodyPart].toLowerCase()
  return (
    `Apply this tattoo design naturally on the ${label} of the person in the photo. ` +
    `Make it look real with natural skin texture, lighting, perspective, and wrap slightly to follow the body contour. ` +
    `Do not change anything else in the photo.`
  )
}

export interface ApplyToBodyOptions {
  bodyPhotoUrl: string
  tattooDesignUrl: string
  userId: string
  projectId: string
  pollTimeoutMs?: number
}

export async function applyTattooToBody(opts: ApplyToBodyOptions): Promise<BodyFusionResults> {
  const { bodyPhotoUrl, tattooDesignUrl, userId, projectId } = opts

  /* 1. 并发创建 4 个任务 */
  const createTasks = BODY_PARTS.map(
    async (bp): Promise<{ bodyPart: BodyPart; taskId?: string; error?: string }> => {
      try {
        const taskId = await createTask({
          model: MODEL,
          input: {
            prompt: buildPrompt(bp),
            input_urls: [bodyPhotoUrl, tattooDesignUrl],
            aspect_ratio: ASPECT_RATIO,
          },
        })
        return { bodyPart: bp, taskId }
      } catch (e) {
        return {
          bodyPart: bp,
          error: e instanceof Error ? e.message : String(e),
        }
      }
    }
  )
  const createResults = await Promise.all(createTasks)

  /* 2. 分流：创建成功的去轮询，失败的直接落结果 */
  const validTasks: Array<{ bodyPart: BodyPart; taskId: string }> = []
  const results: BodyPartResult[] = []

  for (const r of createResults) {
    if (r.taskId) {
      validTasks.push({ bodyPart: r.bodyPart, taskId: r.taskId })
    } else {
      results.push({
        bodyPart: r.bodyPart,
        status: 'failed',
        image: null,
        error: `createTask failed: ${r.error ?? 'unknown'}`,
      })
    }
  }

  /* 3. 并发轮询 */
  const pollResults = await pollManyTasks(
    validTasks.map((t) => t.taskId),
    { timeoutMs: opts.pollTimeoutMs ?? 300_000 }
  )

  /* 4. 并发下载成功的图片到 R2 */
  const downloadPromises = validTasks.map(
    async (task, i): Promise<BodyPartResult> => {
      const poll = pollResults[i]

      if (poll.status === 'rejected') {
        const reason = poll.reason instanceof Error ? poll.reason.message : String(poll.reason)
        return {
          bodyPart: task.bodyPart,
          status: 'failed',
          image: null,
          error: `poll failed: ${reason}`,
        }
      }

      const value = poll.value

      if (value.state !== 'success' || value.resultUrls.length === 0) {
        return {
          bodyPart: task.bodyPart,
          status: 'failed',
          image: null,
          error: value.failMsg ?? `KIE state=${value.state}, no images`,
        }
      }

      try {
        const stored: StoredImage = await downloadToR2(
          value.resultUrls[0],
          makeOutputKey(userId, projectId, 'png')
        )
        return {
          bodyPart: task.bodyPart,
          status: 'completed',
          image: stored,
          error: null,
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return {
          bodyPart: task.bodyPart,
          status: 'failed',
          image: null,
          error: `R2 upload failed: ${msg}`,
        }
      }
    }
  )
  const downloadResults = await Promise.all(downloadPromises)
  results.push(...downloadResults)

  /* 5. 按 BODY_PARTS 原顺序排序 */
  results.sort((a, b) => BODY_PARTS.indexOf(a.bodyPart) - BODY_PARTS.indexOf(b.bodyPart))

  return results
}

async function downloadToR2(sourceUrl: string, key: string): Promise<StoredImage> {
  const { key: r2Key, publicUrl: r2Url } = await fetchUrlAndUpload(sourceUrl, key)
  return { r2Key, r2Url }
}
