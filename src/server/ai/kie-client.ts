/**
 * KIE.AI API 客户端封装。
 *
 * 文档：docs/kie-ai-api.md
 * 接口示例：docs/gpt image2 接口调用.md
 *
 * 提供：
 *   - createTask：创建异步任务
 *   - getRecordInfo：查询单条任务状态
 *   - pollTask：轮询直到 success / failed / 超时
 *
 * 关键注意：
 *   1. KIE 是异步任务模型，createTask 只返回 taskId
 *   2. KIE 的响应 code 字段语义不规则（示例 code:505 但 msg:success），
 *      所以**只看 data.state** 判断成功失败
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

/** KIE 自定义错误类型：速率超限 */
export class KieRateLimitError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'KieRateLimitError'
  }
}

/** KIE 自定义错误类型：轮询超时 */
export class KiePollTimeoutError extends Error {
  constructor(msg: string) {
    super(msg)
    this.name = 'KiePollTimeoutError'
  }
}

function assertEnv(): string {
  if (!KIE_API_KEY) {
    throw new Error('Missing KIE_API_KEY env var. Set it in .env.local')
  }
  return KIE_API_KEY
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 把 resultJson（字符串化 JSON）parse 出 resultUrls */
function parseResultUrls(resultJson: string | null): string[] {
  if (!resultJson) return []
  try {
    const parsed = JSON.parse(resultJson) as { resultUrls?: string[] }
    return Array.isArray(parsed.resultUrls) ? parsed.resultUrls : []
  } catch {
    return []
  }
}

/* ------------------------------------------------------------------ */
/* createTask                                                          */
/* ------------------------------------------------------------------ */

/**
 * 创建异步任务，返回 taskId。
 * 注意：HTTP 200 只表示任务已创建，不代表生成完成。
 *
 * @throws KieRateLimitError HTTP 429
 * @throws Error 其他 HTTP / 业务错误
 */
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

/* ------------------------------------------------------------------ */
/* recordInfo                                                          */
/* ------------------------------------------------------------------ */

/**
 * 查询单条任务详情。
 * 即使任务失败也会返回 data，不会抛错；失败信息在 data.failMsg。
 */
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

/* ------------------------------------------------------------------ */
/* pollTask                                                            */
/* ------------------------------------------------------------------ */

export interface PollOptions {
  /** 轮询间隔，默认 2000ms（KIE 任务通常较慢，不必频繁查询） */
  intervalMs?: number
  /** 最大总时长，默认 180_000ms（3 分钟，gpt-image-2 实测 1-2 分钟） */
  timeoutMs?: number
  /** 可选：每次轮询后回调，用于日志/进度展示 */
  onProgress?: (data: KieRecordInfoData) => void
}

/**
 * 轮询任务直到 success / failed / 超时。
 *
 * - success → 返回 resultUrls
 * - failed  → 返回 failMsg（不抛错，让业务层决定怎么处理）
 * - 超时    → 抛 KiePollTimeoutError（错误信息含最后一次完整 state）
 *
 * 已知的状态值：created / generating / success / failed
 * 其他未知状态一律视为"进行中"继续等。
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
    if (data.state === 'failed') {
      return {
        taskId,
        state: 'failed',
        resultUrls: [],
        failMsg: data.failMsg || 'Task failed (no failMsg)',
        creditsConsumed: data.creditsConsumed,
      }
    }
    // created / generating / 其他未知状态，继续等
    await sleep(intervalMs)
  }

  throw new KiePollTimeoutError(
    `KIE poll timeout after ${timeoutMs}ms (taskId=${taskId}, polls=${pollCount}, ` +
      `elapsed=${Date.now() - startTime}ms, lastState=${lastData?.state ?? 'unknown'}, ` +
      `progress=${lastData?.progress ?? 'n/a'}, failMsg=${lastData?.failMsg || 'n/a'}, ` +
      `lastData=${JSON.stringify(lastData)})`
  )
}

/**
 * 并发轮询多个任务（Step 2 用：4 部位同时轮询）。
 * 单个任务超时/失败不影响其他（用 Promise.allSettled 语义）。
 *
 * 返回值与 Promise.allSettled 一致：
 *   - { status: 'fulfilled', value: KieTaskResult }
 *   - { status: 'rejected', reason: Error }
 */
export async function pollManyTasks(
  taskIds: string[],
  opts: PollOptions = {}
): Promise<PromiseSettledResult<KieTaskResult>[]> {
  return Promise.allSettled(taskIds.map((id) => pollTask(id, opts)))
}
