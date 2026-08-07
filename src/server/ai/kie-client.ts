/**
 * KIE.AI API 客户端封装（从 Demo 迁入 ShipAny Two）。
 *
 * 提供：
 *   - createTask：创建异步任务
 *   - getRecordInfo：查询单条任务状态
 *   - pollTask：轮询直到 success / failed / 超时
 *
 * 关键注意：
 *   1. KIE 是异步任务模型，createTask 只返回 taskId
 *   2. KIE 的响应 code 字段语义不规则，所以只看 data.state 判断成功失败
 *   3. resultJson 是字符串化的 JSON，要二次 parse 拿到 resultUrls
 */
import type {
  KieCreateTaskBody,
  KieRecordInfoData,
  KieRecordInfoResponse,
  KieCreateTaskResponse,
  KieTaskResult,
} from './types'

const KIE_BASE_URL = process.env.KIE_BASE_URL || 'https://api.kie.ai'
const KIE_API_KEY = process.env.KIE_API_KEY

export class KieRateLimitError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'KieRateLimitError'
  }
}

export class KiePollTimeoutError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'KiePollTimeoutError'
  }
}

function assertEnv(): string {
  if (!KIE_API_KEY) {
    throw new Error('Missing KIE_API_KEY env var')
  }
  return KIE_API_KEY
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseResultUrls(resultJson: string | null): string[] {
  if (!resultJson) return []
  try {
    const parsed = JSON.parse(resultJson) as { resultUrls?: string[] }
    return Array.isArray(parsed.resultUrls) ? parsed.resultUrls : []
  } catch {
    return []
  }
}

/** 创建异步任务，返回 taskId */
export async function createTask(body: KieCreateTaskBody): Promise<string> {
  const apiKey = assertEnv()
  const res = await fetch(`${KIE_BASE_URL}/api/v1/jobs/createTask`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (res.status === 429) {
    throw new KieRateLimitError('KIE rate limit (HTTP 429)')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new Error(`KIE createTask HTTP ${res.status}: ${text}`)
  }

  const json: KieCreateTaskResponse = await res.json()
  if (json.code !== 200 || !json.data?.taskId) {
    throw new Error(`KIE createTask failed: code=${json.code} msg=${json.msg}`)
  }
  return json.data.taskId
}

/** 查询单条任务详情 */
export async function getRecordInfo(taskId: string): Promise<KieRecordInfoData> {
  const apiKey = assertEnv()
  const res = await fetch(
    `${KIE_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    }
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '<no body>')
    throw new Error(`KIE recordInfo HTTP ${res.status}: ${text}`)
  }

  const json: KieRecordInfoResponse = await res.json()
  if (!json.data) {
    throw new Error(`KIE recordInfo empty data: ${JSON.stringify(json)}`)
  }
  return json.data
}

export interface PollOptions {
  intervalMs?: number
  timeoutMs?: number
  onProgress?: (data: KieRecordInfoData) => void
}

/**
 * 轮询任务直到 success / failed / 超时
 */
export async function pollTask(taskId: string, opts: PollOptions = {}): Promise<KieTaskResult> {
  const intervalMs = opts.intervalMs ?? 2000
  const timeoutMs = opts.timeoutMs ?? 180_000
  const deadline = Date.now() + timeoutMs
  const startTime = Date.now()

  let lastData: KieRecordInfoData | null = null
  let pollCount = 0

  while (Date.now() < deadline) {
    pollCount++
    const data = await getRecordInfo(taskId)
    lastData = data
    opts.onProgress?.(data)

    if (data.state === 'success') {
      return {
        taskId,
        state: 'success',
        resultUrls: parseResultUrls(data.resultJson),
        failMsg: null,
        creditsConsumed: data.creditsConsumed,
      }
    }
    if (data.state === 'failed' || data.state === 'fail') {
      return {
        taskId,
        state: 'failed',
        resultUrls: [],
        failMsg: data.failMsg || 'Task failed (no failMsg)',
        creditsConsumed: data.creditsConsumed,
      }
    }
    await sleep(intervalMs)
  }

  throw new KiePollTimeoutError(
    `KIE poll timeout after ${timeoutMs}ms (taskId=${taskId}, polls=${pollCount}, ` +
      `elapsed=${Date.now() - startTime}ms, lastState=${lastData?.state ?? 'unknown'}, ` +
      `progress=${lastData?.progress ?? 'n/a'}, failMsg=${lastData?.failMsg || 'n/a'}, ` +
      `lastData=${JSON.stringify(lastData)})`
  )
}

/** 并发轮询多个任务（Step 2 用） */
export async function pollManyTasks(
  taskIds: string[],
  opts: PollOptions = {}
): Promise<PromiseSettledResult<KieTaskResult>[]> {
  return Promise.allSettled(taskIds.map((id) => pollTask(id, opts)))
}
