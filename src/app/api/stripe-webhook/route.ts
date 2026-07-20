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

  // 1. RPC add_credits（先发积分）
  // 顺序很关键：先 RPC 后 UPDATE。
  // 如果 RPC 失败 → throw → Stripe 重试 → status 还是 'pending'，重新走完整流程。
  // 如果先 UPDATE 后 RPC 且 RPC 失败，重试时 status='paid' 直接 return，永远不发积分。
  // 副作用：RPC 成功但 UPDATE 失败时重试会重复加积分，但 UPDATE 单行失败概率极低，
  // 且"用户多得"比"用户少得"对客诉损害小。
  const { error: rpcError } = await supabaseAdmin.rpc('add_credits', {
    p_user_id: userId,
    p_amount: existing.credits_purchased, // 用 DB 里的值，更可信
  })

  if (rpcError) {
    console.error('[stripe-webhook] add_credits RPC failed:', rpcError)
    throw rpcError
  }

  // 2. UPDATE payments.status='paid'（标志已发放，幂等保护）
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
    // 此时 credits 已加但 DB 状态没更新。Stripe 重试会再走一遍 RPC（重复加）。
    // 抛错让上层返回 500，由人工介入修 DB（标 paid 防止再次重试触发）。
    throw updateError
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
  // 状态守卫：只允许 pending → failed。已 paid 的记录不能被覆盖。
  const { error } = await supabaseAdmin
    .from('payments')
    .update({ status: 'failed' })
    .eq('id', paymentId)
    .eq('status', 'pending')

  if (error) {
    console.error('[stripe-webhook] UPDATE async_payment_failed status:', error)
    throw error
  }
}
