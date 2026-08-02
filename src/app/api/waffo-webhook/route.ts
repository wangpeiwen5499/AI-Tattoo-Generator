import { NextResponse } from 'next/server'
import { verifyWebhook, WebhookEventType, type WebhookEvent, type WebhookEventData } from '@waffo/pancake-ts'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// 关键：禁止 Next.js 解析 body，必须读 raw（RSA-SHA256 验签需要原始字节）
export const runtime = 'nodejs'

/**
 * POST /api/waffo-webhook（替换 /api/creem-webhook）
 *
 * Waffo 服务器调用，发放 credits。
 * 验签用 SDK 内嵌公钥（test/prod 自动），不需 WEBHOOK_SECRET（与 Creem 不同）。
 *
 * checkout 的 metadata 透传到 event.data.orderMetadata（SDK 类型确认，字段名是
 * orderMetadata，不是 metadata——这是起初的疑问点，现已通过 .d.ts 证实）。
 *
 * 防重复：payments.status（已 paid 跳过）+ waffo_session_id UNIQUE。
 *
 * 配置：Waffo Dashboard → webhook URL = https://<domain>/api/waffo-webhook，
 *       test mode，事件 order.completed。
 */
export async function POST(req: Request) {
  const body = await req.text() // MUST raw text，不能 .json()（破坏签名）
  const sig = req.headers.get('x-waffo-signature')
  if (!sig) {
    return new Response('Missing signature', { status: 401 })
  }

  // 1. 验签（SDK 内嵌公钥；失败 → 401，Waffo 不重试验签失败）
  let event
  try {
    event = verifyWebhook<WebhookEventData>(body, sig)
  } catch (err) {
    console.error('[waffo-webhook] signature verification failed:', err)
    return new Response('Invalid signature', { status: 401 })
  }

  // 2. 按事件类型分发
  try {
    if (event.eventType === WebhookEventType.OrderCompleted) {
      await handleOrderCompleted(event)
    }
    // 其他事件（subscription.*、refund.*）忽略
  } catch (err) {
    // add_credits / DB 故障 → 500 让 Waffo 重试
    console.error('[waffo-webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({})
}

/**
 * order.completed：一次性付款成功。
 * 从 event.data.orderMetadata 取 payment_id/user_id/credits（checkout 时透传）。
 * 防重复：先查 payments.status，已 paid 直接返回。
 */
async function handleOrderCompleted(event: WebhookEvent) {
  const metadata = event.data.orderMetadata
  const paymentId = metadata?.payment_id
  const userId = metadata?.user_id
  const creditsStr = metadata?.credits

  if (!paymentId || !userId || !creditsStr) {
    console.error('[waffo-webhook] missing orderMetadata', {
      orderId: event.data.orderId,
      orderMetadata: metadata,
    })
    // 不抛错（避免 Waffo 无限重试）
    return
  }

  const credits = Number(creditsStr)
  if (!Number.isFinite(credits) || credits <= 0) {
    console.error('[waffo-webhook] invalid credits value:', creditsStr)
    return
  }

  const supabaseAdmin = getSupabaseAdmin()

  // 查当前状态（防重复发放）
  const { data: existing, error: queryError } = await supabaseAdmin
    .from('payments')
    .select('id, status, user_id, credits_purchased')
    .eq('id', paymentId)
    .maybeSingle()

  if (queryError) {
    console.error('[waffo-webhook] query payment failed:', queryError)
    throw queryError
  }

  if (!existing) {
    console.error('[waffo-webhook] payment row not found:', paymentId)
    return
  }

  if (existing.status === 'paid') {
    console.log('[waffo-webhook] payment already paid, skipping:', paymentId)
    return
  }

  // 防御性检查：orderMetadata.user_id 必须与 DB 一致
  if (existing.user_id !== userId) {
    console.error('[waffo-webhook] user_id mismatch:', {
      dbUserId: existing.user_id,
      metadataUserId: userId,
    })
    throw new Error('user_id mismatch between orderMetadata and DB')
  }

  // 1. RPC add_credits（先发积分）
  // 顺序关键：先 RPC 后 UPDATE。RPC 失败 → throw → Waffo 重试 → status 仍 pending，重跑完整。
  const { error: rpcError } = await supabaseAdmin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: existing.credits_purchased,
  })

  if (rpcError) {
    console.error('[waffo-webhook] add_credits RPC failed:', rpcError)
    throw rpcError
  }

  // 2. UPDATE payments.status='paid' + waffo_order_id（幂等保护）
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      waffo_order_id: event.data.orderId,
    })
    .eq('id', paymentId)

  if (updateError) {
    console.error('[waffo-webhook] UPDATE payment status failed:', updateError)
    throw updateError
  }

  console.log('[waffo-webhook] credits added:', {
    paymentId,
    userId,
    credits: existing.credits_purchased,
  })
}
