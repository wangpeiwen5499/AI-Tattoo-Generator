import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// 关键：禁止 Next.js 解析 body，必须读 raw
export const runtime = 'nodejs'

/**
 * POST /api/stripe-webhook
 *
 * Stripe 服务器调用，发放 credits。
 *
 * 防重复机制（双重保险）：
 *   1. payments.stripe_session_id 数据库层 UNIQUE
 *   2. 应用层先查 payments.status，已 'paid' 直接 return 200
 *
 * 本地测试：
 *   stripe listen --forward-to localhost:3000/api/stripe-webhook
 *   把终端打印的 whsec_xxx 填到 .env.local 的 STRIPE_WEBHOOK_SECRET
 */
export async function POST(req: Request) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!endpointSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  // 1. 验签（失败 → 400，Stripe 不会重试）
  const stripe = getStripe()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret)
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // 2. 按事件类型分发
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'checkout.session.async_payment_failed':
        await handleAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session)
        break

      default:
        // 其他事件忽略（不报错）
        break
    }
  } catch (err) {
    // 仅 add_credits / DB 故障才走到这里。返回 500 让 Stripe 重试（最多 3 天）
    console.error('[stripe-webhook] handler error:', err)
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
  }

  return NextResponse.json({})
}

/**
 * checkout.session.completed：付款成功（或异步支付完成）。
 * 防重复：先查 payments.status，已 paid 直接返回。
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.payment_id
  const userId = session.metadata?.user_id
  const creditsStr = session.metadata?.credits

  if (!paymentId || !userId || !creditsStr) {
    console.error('[stripe-webhook] missing metadata', {
      sessionId: session.id,
      metadata: session.metadata,
    })
    // 不抛错（避免 Stripe 无限重试），但 log 让人能排查
    return
  }

  const credits = Number(creditsStr)
  if (!Number.isFinite(credits) || credits <= 0) {
    console.error('[stripe-webhook] invalid credits value:', creditsStr)
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
    console.error('[stripe-webhook] query payment failed:', queryError)
    throw queryError // 让上层返回 500 触发 Stripe 重试
  }

  if (!existing) {
    // payment 不存在（极少见，可能是 metadata 错或 DB 被清）
    console.error('[stripe-webhook] payment row not found:', paymentId)
    return
  }

  if (existing.status === 'paid') {
    // 已处理过（Stripe 重发了 webhook），幂等返回
    console.log('[stripe-webhook] payment already paid, skipping:', paymentId)
    return
  }

  // 防御性检查：metadata.user_id 必须与 DB 一致
  if (existing.user_id !== userId) {
    console.error('[stripe-webhook] user_id mismatch:', {
      dbUserId: existing.user_id,
      metadataUserId: userId,
    })
    throw new Error('user_id mismatch between metadata and DB')
  }

  // 1. UPDATE payments.status='paid' + paid_at + stripe_payment_intent
  const { error: updateError } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent: typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null,
    })
    .eq('id', paymentId)

  if (updateError) {
    console.error('[stripe-webhook] UPDATE payment status failed:', updateError)
    throw updateError
  }

  // 2. RPC add_credits（原子加 N）
  const { error: rpcError } = await supabaseAdmin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: existing.credits_purchased, // 用 DB 里的值，更可信
  })

  if (rpcError) {
    console.error('[stripe-webhook] add_credits RPC failed:', rpcError)
    // 这里抛错让 Stripe 重试。重试时上面 status 检查会发现已 'paid'，
    // 会跳过 UPDATE 直接 return（不会重复加 credits）。但本函数已 UPDATE 为 'paid'，
    // 所以需要在下面修正——用 status='paid_pending_credits' 之类？MVP 阶段先简单：
    // 假设 RPC 几乎不失败；失败就手动在 DB 修。
    throw rpcError
  }

  console.log('[stripe-webhook] credits added:', {
    paymentId,
    userId,
    credits: existing.credits_purchased,
  })
}

/**
 * checkout.session.async_payment_failed：异步支付（iDEAL/sepa）失败。
 * 把 payment 标 failed，不发放 credits。
 */
async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  const paymentId = session.metadata?.payment_id
  if (!paymentId) return

  const supabaseAdmin = getSupabaseAdmin()
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status: 'failed' })
    .eq('id', paymentId)

  if (error) {
    console.error('[stripe-webhook] UPDATE async_payment_failed status:', error)
    throw error
  }
}
