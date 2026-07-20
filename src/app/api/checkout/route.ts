import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { CREDIT_PACKAGES } from '@/lib/constants'
import type { CheckoutRequestBody, CheckoutResponse } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/checkout
 *
 * 创建 Stripe Checkout Session（Hosted 模式）。
 * 用户付费成功后 Stripe 跳回 /?success=true，
 * 同时 Stripe 服务器异步 POST /api/stripe-webhook 发放 credits。
 */
export async function POST(req: Request) {
  // 1. Clerk 鉴权
  const session = await auth()
  if (!session.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // 2. ensureUser（首次访问写库）
    const email = user.emailAddresses[0]?.emailAddress ?? ''
    if (!email) {
      return NextResponse.json(
        { error: 'Email not found on your Clerk account' },
        { status: 400 }
      )
    }
    await ensureUser(session.userId, email)

    // 3. 解析 body + 校验 packageId
    const body = (await req.json().catch(() => ({}))) as Partial<CheckoutRequestBody>
    const packageId = body.packageId
    const pkg = CREDIT_PACKAGES.find((p) => p.id === packageId)
    if (!pkg || !packageId) {
      return NextResponse.json(
        { error: `Invalid package. Expected one of: ${CREDIT_PACKAGES.map((p) => p.id).join(', ')}` },
        { status: 400 }
      )
    }

    // 4. INSERT payments 记录（status='pending'）
    //    stripe_session_id 是 NOT NULL UNIQUE，需先写占位符，等 Stripe 返回 session.id 后 UPDATE
    const supabaseAdmin = getSupabaseAdmin()
    const placeholderSessionId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const { data: paymentRow, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: session.userId,
        stripe_session_id: placeholderSessionId,
        amount: pkg.priceUsdCents,
        credits_purchased: pkg.credits,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError || !paymentRow) {
      console.error('[checkout] INSERT payments failed:', insertError)
      return NextResponse.json({ error: 'Failed to create payment record' }, { status: 500 })
    }

    // 5. 创建 Stripe Checkout Session
    const stripe = getStripe()
    const origin = new URL(req.url).origin
    let stripeSession
    try {
      stripeSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'usd',
              unit_amount: pkg.priceUsdCents,
              product_data: {
                name: `${pkg.name} — ${pkg.credits} Tattoo Previews`,
                description: pkg.description,
              },
            },
          },
        ],
        success_url: `${origin}/?success=true&credits=${pkg.credits}`,
        cancel_url: `${origin}/pricing?canceled=true`,
        metadata: {
          user_id: session.userId,
          payment_id: paymentRow.id,
          credits: String(pkg.credits),
          package_id: pkg.id,
        },
      })
    } catch (stripeError) {
      console.error('[checkout] stripe.checkout.sessions.create failed:', stripeError)
      // Stripe 创建失败，把 payment 标 failed（保留记录方便排查）
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentRow.id)
      return NextResponse.json(
        { error: 'Failed to create Stripe checkout session' },
        { status: 500 }
      )
    }

    // 6. UPDATE payments.stripe_session_id = 真实 session.id
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ stripe_session_id: stripeSession.id })
      .eq('id', paymentRow.id)

    if (updateError) {
      // UPDATE 失败很罕见（只可能是 DB 抖动）。Stripe session 已创建，
      // 用户仍能付费，webhook 会通过 metadata.payment_id 找回记录。
      console.error('[checkout] UPDATE stripe_session_id failed:', updateError)
    }

    // 7. 返回 URL
    if (!stripeSession.url) {
      console.error('[checkout] stripeSession.url is null', stripeSession.id)
      return NextResponse.json({ error: 'Stripe returned no URL' }, { status: 500 })
    }
    return NextResponse.json<CheckoutResponse>({ url: stripeSession.url })
  } catch (err) {
    console.error('[checkout] unhandled error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
