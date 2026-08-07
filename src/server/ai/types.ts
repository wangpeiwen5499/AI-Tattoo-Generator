/**
 * KIE API + AI 业务层类型定义（从 Demo 迁入 ShipAny Two）。
 *
 * 参考：KIE API 文档 + gpt-image-2 接口示例
 */
import type { BodyPart } from '@/lib/constants'

/* ------------------------------------------------------------------ */
/* KIE API 类型                                                        */
/* ------------------------------------------------------------------ */

/** KIE 支持的模型 ID */
export type KieModel = 'gpt-image-2-text-to-image' | 'gpt-image-2-image-to-image'

/** KIE 支持的宽高比（共 6 个值） */
export type KieAspectRatio = 'auto' | '1:1' | '9:16' | '16:9' | '4:3' | '3:4'

/** createTask 请求 body 中的 input 对象 */
export interface KieTaskInput {
  prompt: string
  input_urls?: string[]
  aspect_ratio?: KieAspectRatio
  nsfw_checker?: boolean
}

/** createTask 完整请求 body */
export interface KieCreateTaskBody {
  model: KieModel
  callBackUrl?: string
  input: KieTaskInput
}

/** createTask 响应 */
export interface KieCreateTaskResponse {
  code: number
  msg: string
  data: { taskId: string }
}

/** recordInfo 返回的 data 字段 */
export interface KieRecordInfoData {
  taskId: string
  model: string
  state: KieTaskState
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

/** 任务状态（用 string 而非 union，避免 KIE 加新值时报错） */
export type KieTaskState = string

/** 轮询结束后归一化的任务结果 */
export interface KieTaskResult {
  taskId: string
  state: KieTaskState
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

/** Step 1 输出：纹身图案 */
export type TattooDesign = StoredImage

/** Step 2 单部位结果 */
export interface BodyPartResult {
  bodyPart: BodyPart
  status: 'completed' | 'failed'
  image: StoredImage | null
  error: string | null
}

/** Step 2 整体输出：4 部位结果 */
export type BodyFusionResults = BodyPartResult[]
