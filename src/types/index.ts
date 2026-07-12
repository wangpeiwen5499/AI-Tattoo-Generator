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
  stripe_session_id: string
  stripe_payment_intent: string | null
  amount: number
  credits_purchased: number
  status: PaymentStatus
  created_at: string
  paid_at: string | null
}
