/**
 * KIE API + AI 业务层类型定义。
 *
 * 参考：docs/kie-ai-api.md
 * 接口示例：docs/gpt image2 接口调用.md
 */
import type { BodyPart } from '@/lib/constants'

/* ------------------------------------------------------------------ */
/* KIE API 类型                                                        */
/* ------------------------------------------------------------------ */

/** KIE 支持的模型 ID（顶层 model 字段） */
export type KieModel = 'gpt-image-2-text-to-image' | 'gpt-image-2-image-to-image'

/** KIE 支持的宽高比（共 6 个值） */
export type KieAspectRatio = 'auto' | '1:1' | '9:16' | '16:9' | '4:3' | '3:4'

/** createTask 请求 body 中的 input 对象 */
export interface KieTaskInput {
  prompt: string
  /** image-to-image 必填；text-to-image 不传 */
  input_urls?: string[]
  aspect_ratio?: KieAspectRatio
  /** 内容审核，默认 true */
  nsfw_checker?: boolean
}

/** createTask 完整请求 body */
export interface KieCreateTaskBody {
  model: KieModel
  /** 可选回调 URL，MVP 不传（用轮询） */
  callBackUrl?: string
  input: KieTaskInput
}

/** createTask 响应 */
export interface KieCreateTaskResponse {
  code: number
  msg: string
  data: { taskId: string }
}

/** recordInfo 返回的 data 字段（部分关键字段） */
export interface KieRecordInfoData {
  taskId: string
  model: string
  state: KieTaskState
  /** 字符串化的 JSON：{ resultUrls: string[] } */
  resultJson: string | null
  failCode: string
  failMsg: string
  progress: number
  creditsConsumed: number
  costTime: number
}

export interface KieRecordInfoResponse {
  code: number
  msg: string
  data: KieRecordInfoData
}

/**
 * 任务状态：KIE 的 code 字段语义不规则（示例里 code:505 但 msg:success），所以只看 state。
 *
 * 实测见过的值：created / generating / success / failed
 * （文档示例只提到 success，但实际中间态可能是 generating 而非 running）
 *
 * 用 string 而不是 union，避免 KIE 后续加新状态值时 TypeScript 报错。
 * 业务层只在 state === 'success' 或 'failed' 时停止轮询。
 */
export type KieTaskState = string

/** 轮询结束后归一化的任务结果 */
export interface KieTaskResult {
  taskId: string
  state: KieTaskState
  /** 已从 resultJson parse 出来的 URL 数组 */
  resultUrls: string[]
  failMsg: string | null
  creditsConsumed: number
}

/* ------------------------------------------------------------------ */
/* 业务层类型                                                          */
/* ------------------------------------------------------------------ */

/** 单张已落 R2 的图片 */
export interface StoredImage {
  r2Key: string
  r2Url: string
}

/** Step 1 输出：纹身图案（同 StoredImage，独立命名便于语义区分） */
export type TattooDesign = StoredImage

/** Step 2 单部位结果（无论成功失败都有，用 Promise.allSettled 容错） */
export interface BodyPartResult {
  bodyPart: BodyPart
  status: 'completed' | 'failed'
  image: StoredImage | null
  error: string | null
}

/** Step 2 整体输出：4 部位结果 */
export type BodyFusionResults = BodyPartResult[]
