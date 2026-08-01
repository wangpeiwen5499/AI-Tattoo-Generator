/** 数据库行的 TypeScript 类型（与 supabase/migrations/0001_init.sql 对应） */

export interface UserRow {
  id: string
  email: string
  credits: number
  created_at: string
  updated_at: string
}

export type ProjectStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type GenerationStatus = 'pending' | 'completed' | 'failed'

export interface ProjectRow {
  id: string
  user_id: string
  body_photo_key: string
  body_photo_url: string
  prompt: string
  status: ProjectStatus
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export interface GenerationRow {
  id: string
  project_id: string
  user_id: string
  body_part: string
  tattoo_image_key: string | null
  result_image_key: string | null
  result_image_url: string | null
  status: GenerationStatus
  created_at: string
}

export type PaymentStatus = 'pending' | 'paid' | 'failed'

export interface PaymentRow {
  id: string
  user_id: string
  creem_checkout_id: string
  creem_order_id: string | null
  amount: number
  credits_purchased: number
  status: PaymentStatus
  created_at: string
  paid_at: string | null
}

/* ============ API 响应类型 ============ */

import type { BodyPart } from '@/lib/constants'

/** /api/upload-url 响应 */
export interface UploadUrlResponse {
  key: string
  uploadUrl: string
  publicUrl: string
}

/** /api/credits 响应 */
export interface CreditsResponse {
  credits: number
}

/** /api/generate 单张部位图结果（与后端 route.ts 返回结构一致） */
export interface GenerateImage {
  bodyPart: BodyPart
  status: 'completed' | 'failed'
  url: string | null
  error?: string | null
}

/** /api/generate 成功响应 */
export interface GenerateResponse {
  projectId: string
  tattooDesignUrl: string
  images: GenerateImage[]
  /** 全失败时后端会带这个字段，提示已退款 */
  error?: string
}

/** POST /api/generate 响应（异步：立即返回，只给 projectId） */
export interface GenerateTriggerResponse {
  projectId: string
}

/** GET /api/generate/status 响应（前端轮询） */
export interface GenerationStatusResponse {
  status: 'processing' | 'completed' | 'failed'
  /** Step1 成功后从 generations[0].tattoo_image_key 还原；Step1 失败时为 null */
  tattooDesignUrl: string | null
  images: GenerateImage[]
  /** failed 时有值（project.error_message） */
  error?: string | null
}

/* ============ Stripe→Creem 支付 ============ */

/** 定价档位 ID（与 CREDIT_PACKAGES 的 id 字段对应） */
export type PackageId = 'starter' | 'popular' | 'pro'

/** POST /api/checkout 请求体 */
export interface CheckoutRequestBody {
  packageId: PackageId
}

/** POST /api/checkout 成功响应 */
export interface CheckoutResponse {
  url: string
}

/* ============ Day 6: 历史记录页 ============ */

/** 单个 project 关联其 4 条 generations（Supabase join 查询返回结构） */
export type ProjectWithGenerations = ProjectRow & {
  generations: GenerationRow[]
}
