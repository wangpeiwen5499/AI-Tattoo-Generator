import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { getCreem } from '@/lib/creem'
import { CREDIT_PACKAGES } from '@/lib/constants'
import type { CheckoutRequestBody, CheckoutResponse } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/checkout
 *
 * 创建 Creem checkout session（替换 Stripe Checkout）。
 * 用户付费成功后 Creem 跳回 /?success=true，
 * 同时 Creem 服务器异步 POST /api/creem-webhook 发放 credits。
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

    // 4. 取 productId（从环境变量）
    const productId = process.env[pkg.creemProductId]
    if (!productId) {
      console.error(`[checkout] product env var not set: ${pkg.creemProductId}`)
      return NextResponse.json({ error: 'Product not configured' }, { status: 500 })
    }

    // 5. INSERT payments 记录（status='pending'）
    //    creem_checkout_id 是 NOT NULL UNIQUE，需先写占位符，等 Creem 返回 checkout.id 后 UPDATE
    const supabaseAdmin = getSupabaseAdmin()
    const placeholderCheckoutId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const { data: paymentRow, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: session.userId,
        creem_checkout_id: placeholderCheckoutId,
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

    // 6. 创建 Creem checkout session
    const creem = getCreem()
    const origin = new URL(req.url).origin
    let checkout
    try {
      checkout = await creem.checkouts.create({
        productId,
        successUrl: `${origin}/?success=true`,
        customer: { email },
        requestId: paymentRow.id,
        metadata: {
          user_id: session.userId,
          payment_id: paymentRow.id,
          credits: String(pkg.credits),
          package_id: pkg.id,
        },
      })
    } catch (creemError) {
      console.error('[checkout] creem.checkouts.create failed:', creemError)
      // Creem 创建失败，把 payment 标 failed（保留记录方便排查）
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentRow.id)
      return NextResponse.json(
        { error: 'Failed to create Creem checkout session' },
        { status: 500 }
      )
    }

    // 7. UPDATE payments.creem_checkout_id = 真实 checkout.id（ch_xxx）
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ creem_checkout_id: checkout.id })
      .eq('id', paymentRow.id)

    if (updateError) {
      // UPDATE 失败很罕见。Creem session 已创建，用户仍能付费，
      // webhook 会通过 metadata.payment_id 找回记录。
      console.error('[checkout] UPDATE creem_checkout_id failed:', updateError)
    }

    // 8. 返回 checkout_url（接口契约不变，前端仍取 data.url）
    if (!checkout.checkoutUrl) {
      console.error('[checkout] checkout.checkoutUrl is null', checkout.id)
      return NextResponse.json({ error: 'Creem returned no URL' }, { status: 500 })
    }
    return NextResponse.json<CheckoutResponse>({ url: checkout.checkoutUrl })
  } catch (err) {
    console.error('[checkout] unhandled error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
