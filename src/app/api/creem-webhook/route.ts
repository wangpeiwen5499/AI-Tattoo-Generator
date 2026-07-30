import { NextResponse } from 'next/server'
import { constructWebhookEventEntity } from 'creem/webhooks'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// 关键：禁止 Next.js 解析 body，必须读 raw（验签需要原始字节）
export const runtime = 'nodejs'

/**
 * POST /api/creem-webhook（替换 /api/stripe-webhook）
 *
 * Creem 服务器调用，发放 credits。
 *
 * 防重复机制（双重保险）：
 *   1. payments.creem_checkout_id 数据库层 UNIQUE
 *   2. 应用层先查 payments.status，已 'paid' 直接 return 200
 *
 * 本地测试：
 *   ngrok http 3000 → Creem dashboard 注册 dev endpoint 指向
 *   https://<ngrok>/api/creem-webhook，把生成的 secret 填到 .env.local 的 CREEM_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const body = await req.text()
  const endpointSecret = process.env.CREEM_WEBHOOK_SECRET
  if (!endpointSecret) {
    console.error('[creem-webhook] CREEM_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // 1. 验签 + 解析（一步完成；失败 → 401，Creem 不会重试验签失败）
  const event = await constructWebhookEventEntity(body, req.headers, {
    secret: endpointSecret,
  }).catch((err: unknown) => {
    console.error('[creem-webhook] signature verification failed:', err)
    return null
  })
  if (!event) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  // 2. 按事件类型分发
  try {
    if (event.eventType === 'checkout.completed') {
      await handleCheckoutCompleted(event.object)
    }
    // 其他事件（subscription.*、refund.created 等）忽略
  } catch (err) {
    // 仅 add_credits / DB 故障才走到这里。返回 500 让 Creem 重试（30s/1min/5min/1h）
    console.error('[creem-webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({})
}

/**
 * checkout.completed：付款成功。
 * Creem payload: event.object = { id, order:{id}, metadata:{...}, ... }
 * 防重复：先查 payments.status，已 paid 直接返回。
 */
type CreemCheckoutObject = {
  id: string
  order?: { id?: string } | null
  metadata?: Record<string, string | undefined> | null
}

async function handleCheckoutCompleted(obj: CreemCheckoutObject) {
  const paymentId = obj.metadata?.payment_id
  const userId = obj.metadata?.user_id
  const creditsStr = obj.metadata?.credits

  if (!paymentId || !userId || !creditsStr) {
    console.error('[creem-webhook] missing metadata', {
      checkoutId: obj.id,
      metadata: obj.metadata,
    })
    // 不抛错（避免 Creem 无限重试），但 log 让人能排查
    return
  }

  const credits = Number(creditsStr)
  if (!Number.isFinite(credits) || credits <= 0) {
    console.error('[creem-webhook] invalid credits value:', creditsStr)
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
    console.error('[creem-webhook] query payment failed:', queryError)
    throw queryError // 让上层返回 500 触发 Creem 重试
  }

  if (!existing) {
    console.error('[creem-webhook] payment row not found:', paymentId)
    return
  }

  if (existing.status === 'paid') {
    console.log('[creem-webhook] payment already paid, skipping:', paymentId)
    return
  }

  // 防御性检查：metadata.user_id 必须与 DB 一致
  if (existing.user_id !== userId) {
    console.error('[creem-webhook] user_id mismatch:', {
      dbUserId: existing.user_id,
      metadataUserId: userId,
    })
    throw new Error('user_id mismatch between metadata and DB')
  }

  // 1. RPC add_credits（先发积分）
  // 顺序很关键：先 RPC 后 UPDATE。
  // RPC 失败 → throw → Creem 重试 → status 还是 'pending'，重新走完整流程。
  // 若先 UPDATE 后 RPC 且 RPC 失败，重试时 status='paid' 直接 return，永远不发积分。
  const { error: rpcError } = await supabaseAdmin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: existing.credits_purchased, // 用 DB 里的值，更可信
  })

  if (rpcError) {
    console.error('[creem-webhook] add_credits RPC failed:', rpcError)
    throw rpcError
  }

  // 2. UPDATE payments.status='paid' + creem_order_id（标志已发放，幂等保护）
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      creem_order_id: obj.order?.id ?? null,
    })
    .eq('id', paymentId)

  if (updateError) {
    console.error('[creem-webhook] UPDATE payment status failed:', updateError)
    throw updateError
  }

  console.log('[creem-webhook] credits added:', {
    paymentId,
    userId,
    credits: existing.credits_purchased,
  })
}
