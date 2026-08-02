# Creem → Waffo Pancake 支付迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐 task 执行。步骤用 `- [ ]` 复选框跟踪。
>
> **依据**：`docs/superpowers/specs/2026-08-02-creem-to-waffo-migration-design.md`（已与用户确认）。

**Goal:** 把支付从 Creem 整体迁移到 Waffo Pancake，前端契约不变。

**Architecture:** `lib/waffo.ts` SDK 单例 → `/api/checkout` 改 `checkout.createSession(onetime)` → `/api/waffo-webhook` 用 `verifyWebhook`（SDK 内嵌公钥，不需 secret）→ `payments` 列 rename creem→waffo（0004）→ 清理 Creem（删 lib/creem + webhook + 卸包）。

**Tech Stack:** Next.js 16.2.10、`@waffo/pancake-ts@0.16.1`、Clerk、Supabase（service_role）。

## Global Constraints

- 所有回答与 **commit message 用中文**（`CLAUDE.md`）；每个 commit 末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **项目无测试框架**：验证用 `npm run lint` + `npm run build` + 手动。
- **`@waffo/pancake-ts` 服务端 only**：只在 API Route / lib import，**不进 'use client' 或 middleware**（private key 不能泄露到浏览器）。
- **webhook 验签用 SDK 内嵌公钥**（`verifyWebhook`），**不需 `WEBHOOK_SECRET` env**（与 Creem 不同）。
- **webhook 必须 raw body**：`await req.text()`，**不能用 `.json()`**（破坏 RSA-SHA256 签名）。`export const runtime = 'nodejs'`。
- **金额用 display amount 字符串**（`"4.99"`），不是 cents（Creem/Stripe 用 cents，Waffo 不一样）。
- **migration `0004_waffo.sql` 需用户在 Supabase 手动跑**（Task 5 只写文件）。
- **3 档产品 / webhook URL / env 由用户在外部操作**（Dashboard + Supabase + Vercel），计划里标注（Task 7）。
- 复用现有 `add_credits` RPC、`payments` 表、Clerk auth、PricingCards、PaymentFeedback。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `package.json` | **修改** | 加 `@waffo/pancake-ts`，删 `creem` |
| `src/lib/waffo.ts` | **新建** | `getWaffo()` 单例（替换 lib/creem.ts） |
| `src/lib/creem.ts` | **删除** | Creem 单例 |
| `src/lib/constants.ts` | **修改** | `CREDIT_PACKAGES.creemProductId` → `waffoProductId` |
| `src/types/index.ts` | **修改** | `CreditPackage.creemProductId` → `waffoProductId` |
| `src/app/api/checkout/route.ts` | **修改** | `creem.checkouts.create` → `waffo.checkout.createSession` |
| `src/app/api/creem-webhook/` | **删除**（整个目录） | Creem webhook |
| `src/app/api/waffo-webhook/route.ts` | **新建** | `verifyWebhook` + `order.completed` 发 credits |
| `supabase/migrations/0004_waffo.sql` | **新建** | payments 列 rename creem→waffo |
| `.env.example` | **修改** | 加 `WAFFO_*`，删 `CREEM_*` |

---

## Task 1: 装 `@waffo/pancake-ts` + 新建 `lib/waffo.ts`

**Files:**
- Modify: `package.json`（`npm install`）
- Create: `src/lib/waffo.ts`

**Interfaces:**
- Produces: `getWaffo(): WaffoPancake`（lazy 单例）。Task 3/4 消费。

- [ ] **Step 1: 装包**

Run: `npm install @waffo/pancake-ts`
Expected: `added 1 package`（zero deps）。`package.json` 多 `@waffo/pancake-ts`。

- [ ] **Step 2: 新建 `src/lib/waffo.ts`**

```ts
import { WaffoPancake } from '@waffo/pancake-ts'

/**
 * Waffo Pancake 服务端单例（替换 lib/creem.ts）。
 *
 * ⚠️ 只在服务端（API Route）import，不要进 'use client' 或 middleware
 *    （private key 不能泄露到浏览器）。
 *
 * WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY 从 .env.local 读。
 * private key 支持 PEM / escaped \n / base64，SDK auto-normalize。
 */
function createWaffoClient(): WaffoPancake {
  const merchantId = process.env.WAFFO_MERCHANT_ID
  const privateKey = process.env.WAFFO_PRIVATE_KEY
  if (!merchantId || !privateKey) {
    throw new Error('WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY not set. Add to .env.local')
  }
  return new WaffoPancake({ merchantId, privateKey })
}

// Lazy 全局单例，避免每次调用都新建 client
let _waffo: WaffoPancake | null = null
export function getWaffo(): WaffoPancake {
  if (!_waffo) _waffo = createWaffoClient()
  return _waffo
}
```

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过（lib/waffo.ts 暂未被引用，不影响）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/waffo.ts
git commit -m "feat: 装 @waffo/pancake-ts + 新建 lib/waffo 单例

替换 lib/creem.ts。WaffoPancake(merchantId, privateKey) lazy 单例。
SDK 零运行时依赖、服务端 only。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: `constants.ts` + `types/index.ts` 改 `creemProductId` → `waffoProductId`

**Files:**
- Modify: `src/lib/constants.ts`（`CREDIT_PACKAGES` 三档 + `CreditPackage` interface）
- Modify: `src/types/index.ts`（`CreditPackage` interface）

**Interfaces:**
- Produces: `CreditPackage.waffoProductId: string`（env 变量名，如 `'WAFFO_PRODUCT_STARTER'`）。Task 3 消费（`process.env[pkg.waffoProductId]`）。

- [ ] **Step 1: `src/lib/constants.ts` — interface + 三档改名**

把 `CreditPackage` interface 里：
```ts
  /** 该档位对应的 Creem product 环境变量名（值在 .env.local，如 CREEM_PRODUCT_STARTER） */
  creemProductId: string
```
替换为：
```ts
  /** 该档位对应的 Waffo product 环境变量名（值在 .env.local，如 WAFFO_PRODUCT_STARTER） */
  waffoProductId: string
```

把 `CREDIT_PACKAGES` 三档的 `creemProductId` 字段（用 `replace_all` 一次性替换字段名 + 值前缀）。三处：
- `creemProductId: 'CREEM_PRODUCT_STARTER'` → `waffoProductId: 'WAFFO_PRODUCT_STARTER'`
- `creemProductId: 'CREEM_PRODUCT_POPULAR'` → `waffoProductId: 'WAFFO_PRODUCT_POPULAR'`
- `creemProductId: 'CREEM_PRODUCT_PRO'` → `waffoProductId: 'WAFFO_PRODUCT_PRO'`

> 用三个独立 Edit（或 sed 思路：先 `creemProductId` → `waffoProductId`（replace_all），再 `'CREEM_PRODUCT_` → `'WAFFO_PRODUCT_`（replace_all））。

- [ ] **Step 2: `src/types/index.ts` — `CreditPackage` interface 改名**

把：
```ts
export interface CreditPackage {
  id: string
  name: string
  credits: number
  /** 单位：美元分（499 = $4.99） */
  priceUsdCents: number
  /** Creem 价格描述，用于 checkout 显示 */
  description: string
  /** 该档位对应的 Creem product 环境变量名（值在 .env.local，如 CREEM_PRODUCT_STARTER） */
  creemProductId: string
  highlighted?: boolean
}
```
里的 `creemProductId: string` → `waffoProductId: string`（注释也改 Creem→Waffo）。

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: 报错！`/api/checkout` 还用 `pkg.creemProductId`（已改名）→ TS 错。**这是预期的**（Task 3 会修）。临时在 Task 3 之前，build 会失败——所以 Task 2 和 Task 3 要连续做。

> 如果想 Task 2 单独 build 过，可先做 Task 3 再 Task 2。但逻辑上 constants 先改更清晰。此处接受 Task 2 后 build 暂时失败，Task 3 修好。

- [ ] **Step 4: Commit（与 Task 3 合并提交，或单独提交接受 build 失败）**

为保持每 commit 可 build，**Task 2 + Task 3 一起 commit**（见 Task 3 Step 末尾）。此处暂不 commit。

---

## Task 3: `/api/checkout` 改 Waffo

**Files:** Modify `src/app/api/checkout/route.ts`

**Interfaces:**
- Consumes: `getWaffo()`（Task 1）、`pkg.waffoProductId`（Task 2）。

- [ ] **Step 1: 改 import（getCreem → getWaffo）**

把：
```ts
import { getCreem } from '@/lib/creem'
```
替换为：
```ts
import { getWaffo } from '@/lib/waffo'
```

- [ ] **Step 2: 改 productId env 取值**

把：
```ts
    const productId = process.env[pkg.creemProductId]
```
替换为：
```ts
    const productId = process.env[pkg.waffoProductId]
```

- [ ] **Step 3: 改 INSERT payments（creem_checkout_id → waffo_session_id）**

把：
```ts
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
```
替换为：
```ts
    const placeholderSessionId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const { data: paymentRow, error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id: session.userId,
        waffo_session_id: placeholderSessionId,
        amount: pkg.priceUsdCents,
        credits_purchased: pkg.credits,
        status: 'pending',
      })
      .select()
      .single()
```

- [ ] **Step 4: 改 checkout 创建（creem.checkouts.create → waffo.checkout.createSession）**

把：
```ts
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
```
替换为：
```ts
    // 6. 创建 Waffo checkout session（变量名 waffoSession，避免与上面 auth() 的 Clerk session 冲突）
    const waffo = getWaffo()
    const origin = new URL(req.url).origin
    let waffoSession
    try {
      waffoSession = await waffo.checkout.createSession({
        productId,
        productType: 'onetime',
        currency: 'USD',
        successUrl: `${origin}/?success=true`,
        buyerEmail: email,
        metadata: {
          user_id: session.userId,
          payment_id: paymentRow.id,
          credits: String(pkg.credits),
          package_id: pkg.id,
        },
      })
    } catch (waffoError) {
      console.error('[checkout] waffo.checkout.createSession failed:', waffoError)
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentRow.id)
      return NextResponse.json(
        { error: 'Failed to create Waffo checkout session' },
        { status: 500 }
      )
    }
```

> 注：`metadata.user_id: session.userId` 里的 `session` 是第 20 行 `await auth()` 的 Clerk session（保持不变）；Waffo checkout 结果用 `waffoSession`。

- [ ] **Step 5: 改 UPDATE payments.creem_checkout_id → waffo_session_id**

把：
```ts
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
```
替换为：
```ts
    // 7. UPDATE payments.waffo_session_id = 真实 session.sessionId（cs_xxx）
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({ waffo_session_id: waffoSession.sessionId })
      .eq('id', paymentRow.id)

    if (updateError) {
      console.error('[checkout] UPDATE waffo_session_id failed:', updateError)
    }

    // 8. 返回 checkoutUrl（接口契约不变，前端仍取 data.url）
    if (!waffoSession.checkoutUrl) {
      console.error('[checkout] waffoSession.checkoutUrl is null', waffoSession.sessionId)
      return NextResponse.json({ error: 'Waffo returned no URL' }, { status: 500 })
    }
    return NextResponse.json<CheckoutResponse>({ url: waffoSession.checkoutUrl })
```

- [ ] **Step 6: 改文件头注释（Creem → Waffo）**

把：
```ts
/**
 * POST /api/checkout
 *
 * 创建 Creem checkout session（替换 Stripe Checkout）。
 * 用户付费成功后 Creem 跳回 /?success=true，
 * 同时 Creem 服务器异步 POST /api/creem-webhook 发放 credits。
 */
```
替换为：
```ts
/**
 * POST /api/checkout
 *
 * 创建 Waffo Pancake checkout session（替换 Creem）。
 * 用户付费成功后 Waffo 跳回 /?success=true，
 * 同时 Waffo 服务器异步 POST /api/waffo-webhook 发放 credits。
 */
```

- [ ] **Step 7: lint + build（含 Task 2 的 constants/types 改动）**

Run: `npm run lint && npm run build`
Expected: 全过（checkout 改完 + constants/types 改完，build 恢复）。

- [ ] **Step 8: Commit（Task 2 + Task 3 合并）**

```bash
git add src/lib/constants.ts src/types/index.ts src/app/api/checkout/route.ts
git commit -m "feat: /api/checkout 迁移到 Waffo + creemProductId→waffoProductId

- constants/types: CREDIT_PACKAGES.creemProductId→waffoProductId（CREEM_PRODUCT_→WAFFO_PRODUCT_）
- checkout: creem.checkouts.create → waffo.checkout.createSession(onetime, USD, successUrl, buyerEmail, metadata)
- payments: creem_checkout_id → waffo_session_id（INSERT/UPDATE）
- 契约不变：仍返回 {url}，前端不动

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: 新建 `/api/waffo-webhook`

**Files:** Create `src/app/api/waffo-webhook/route.ts`

**Interfaces:**
- Consumes: `verifyWebhook` + `WebhookEventType`（`@waffo/pancake-ts`）、`add_credits` RPC、`payments` 表。
- Produces: `POST /api/waffo-webhook`（Waffo 服务器调，发 credits）。

- [ ] **Step 1: 新建 `src/app/api/waffo-webhook/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { verifyWebhook, WebhookEventType } from '@waffo/pancake-ts'
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
 * 防重复：payments.status（已 paid 跳过）+ waffo_session_id UNIQUE。
 *
 * 配置：Waffo Dashboard → webhook URL = https://<domain>/api/waffo-webhook，
 *       test mode，事件 order.completed。
 */
export async function POST(req: Request) {
  const body = await req.text() // MUST raw text，不能 .json()
  const sig = req.headers.get('x-waffo-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
  }

  // 1. 验签（SDK 内嵌公钥；失败 → 401，Waffo 不重试验签失败）
  let event
  try {
    event = verifyWebhook(body, sig)
  } catch (err) {
    console.error('[waffo-webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
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

type WaffoWebhookEvent = {
  id: string
  eventType: string
  eventId: string
  storeId: string
  mode: 'test' | 'prod'
  data: {
    orderId: string
    buyerEmail: string
    currency: string
    amount: number
    taxAmount: number
    productName: string
    // metadata 是否透传待实测（spec §8）；先假设存在
    metadata?: Record<string, string | undefined> | null
  }
}

/**
 * order.completed：一次性付款成功。
 * 防重复：先查 payments.status，已 paid 直接返回。
 *
 * ⚠️ metadata 假设：Waffo 文档说 checkout metadata "Passed through to webhook event.data"，
 *    但 event shape 未列 metadata 字段。这里假设 event.data.metadata.{payment_id,user_id,credits} 存在。
 *    若实测不透传，需改兜底（buyerEmail + productName 映射 credits）—— 见 spec §8。
 */
async function handleOrderCompleted(event: WaffoWebhookEvent) {
  const metadata = event.data.metadata
  const paymentId = metadata?.payment_id
  const userId = metadata?.user_id
  const creditsStr = metadata?.credits

  // 调试：第一次 webhook 打印完整 event.data，确认 metadata 是否透传
  console.log('[waffo-webhook] order.completed event.data:', JSON.stringify(event.data))

  if (!paymentId || !userId || !creditsStr) {
    console.error('[waffo-webhook] missing metadata (may not be passed through)', {
      orderId: event.data.orderId,
      data: event.data,
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

  // 防御性检查：metadata.user_id 必须与 DB 一致
  if (existing.user_id !== userId) {
    console.error('[waffo-webhook] user_id mismatch:', {
      dbUserId: existing.user_id,
      metadataUserId: userId,
    })
    throw new Error('user_id mismatch between metadata and DB')
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
```

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/waffo-webhook/route.ts
git commit -m "feat: 加 POST /api/waffo-webhook（verifyWebhook + 发 credits）

替换 /api/creem-webhook。verifyWebhook 用 SDK 内嵌公钥（不需 WEBHOOK_SECRET），
raw body 验签，order.completed → metadata 关联 payments → add_credits → UPDATE paid。
含 event.data 调试日志（验证 metadata 透传，spec §8）。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: migration `0004_waffo.sql`

**Files:** Create `supabase/migrations/0004_waffo.sql`

- [ ] **Step 1: 新建 `supabase/migrations/0004_waffo.sql`**

```sql
-- 0004: payments 表 Creem 列重命名为 Waffo
-- 在 Supabase Dashboard > SQL Editor 中执行此文件
-- UNIQUE 约束由 Postgres 自动保留；idx_payments_user_id 不涉及这两列，不动

alter table public.payments rename column creem_checkout_id to waffo_session_id;
alter table public.payments rename column creem_order_id     to waffo_order_id;
```

- [ ] **Step 2: Commit（写文件即可，不自动执行）**

```bash
git add supabase/migrations/0004_waffo.sql
git commit -m "feat: 加 0004 migration（payments 列 creem→waffo rename）

creem_checkout_id → waffo_session_id；creem_order_id → waffo_order_id。
UNIQUE 约束自动保留。需在 Supabase Dashboard 手动执行。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 清理 Creem（删 lib/creem + creem-webhook + 卸包 + .env.example）

**Files:**
- Delete: `src/lib/creem.ts`
- Delete: `src/app/api/creem-webhook/`（整个目录，含 route.ts）
- Modify: `package.json`（`npm uninstall creem`）
- Modify: `.env.example`（加 `WAFFO_*`，删 `CREEM_*`）

- [ ] **Step 1: 删 lib/creem.ts**

Run: `rm src/lib/creem.ts`（或 `git rm`）

- [ ] **Step 2: 删 /api/creem-webhook 目录**

Run: `rm -r src/app/api/creem-webhook`（或 `git rm -r`）

- [ ] **Step 3: 卸 creem 包**

Run: `npm uninstall creem`
Expected: `removed 1 package`。

- [ ] **Step 4: 改 `.env.example`（加 WAFFO_*，删 CREEM_*）**

把 Creem 相关行：
```
CREEM_API_KEY=...
CREEM_WEBHOOK_SECRET=...
CREEM_PRODUCT_STARTER=...
CREEM_PRODUCT_POPULAR=...
CREEM_PRODUCT_PRO=...
```
替换为：
```
# Waffo Pancake（替换 Creem）
WAFFO_MERCHANT_ID=MER_xxx
WAFFO_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----
WAFFO_PRODUCT_STARTER=PROD_xxx
WAFFO_PRODUCT_POPULAR=PROD_xxx
WAFFO_PRODUCT_PRO=PROD_xxx
```

- [ ] **Step 5: lint + build + grep 确认无 creem 残留**

Run:
```bash
npm run lint && npm run build
git grep -niE "creem" -- src/  # 应只剩 handoff 历史文档（不在 src/）
```
Expected: build 全过；`git grep -niE "creem" -- src/` 无输出（src/ 内无 creem 残留）。

- [ ] **Step 6: Commit**

```bash
git add -A  # 含删除的文件
git commit -m "chore: 清理 Creem（删 lib/creem + creem-webhook + 卸包 + env）

- 删 src/lib/creem.ts
- 删 src/app/api/creem-webhook/（整个目录）
- npm uninstall creem
- .env.example: CREEM_* → WAFFO_*

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 用户外部操作 + 端到端验证

> 本 task 由用户在外部操作（Dashboard / Supabase / Vercel / .env.local），Claude 提供清单。

- [ ] **Step 1: Waffo Dashboard 建 3 个一次性产品**

Dashboard → Products → 建 3 个 onetime：
- Starter：$4.99，taxCategory=`digital_goods`
- Popular：$14.99，taxCategory=`digital_goods`
- Pro：$29.99，taxCategory=`digital_goods`

拿 3 个 `PROD_xxx`。

- [ ] **Step 2: 填 `.env.local`**

```
WAFFO_MERCHANT_ID=MER_16spMbT8fzeS4i6HBHSN6J
WAFFO_PRIVATE_KEY=<你的 PEM private key，escaped \n>
WAFFO_PRODUCT_STARTER=PROD_xxx
WAFFO_PRODUCT_POPULAR=PROD_xxx
WAFFO_PRODUCT_PRO=PROD_xxx
```
删 `CREEM_*`。

- [ ] **Step 3: Supabase 跑 0004 migration**

Dashboard → SQL Editor → 执行 `0004_waffo.sql`。

- [ ] **Step 4: Waffo Dashboard 配 webhook**

URL=`https://tattoovis.ink/api/waffo-webhook`（本地 dev 用 ngrok），test mode，事件 `order.completed`。

- [ ] **Step 5: Waffo Dashboard 配全局 cancel URL**

→ `/pricing?canceled=true`。

- [ ] **Step 6: 本地端到端验证**

`npm run dev` + `ngrok http 3000`（webhook 用 ngrok URL）：
- 点 Starter → Waffo checkout → 测试卡 `4576 7500 0000 0110` → 跳回 `/?success=true` + toast + credits +5
- DevTools 看 `/api/waffo-webhook` 收到 event,**检查 console `[waffo-webhook] order.completed event.data:` 日志**——确认 `metadata` 是否透传（§8 风险）
- DB：payments 新增 status=paid（waffo_session_id/waffo_order_id 有值），users.credits +5
- 防重复：resend 同 webhook，payments.status=paid 跳过

- [ ] **Step 7: Vercel 环境变量 + push 生产**

Vercel → Settings → Environment Variables：加 `WAFFO_*`，删 `CREEM_*`。然后 `git push origin main`。

- [ ] **Step 8: 生产 tattoivis.ink 端到端**

点 Starter → checkout → 测试卡 → 跳回 + credits +5。webhook 在 Waffo dashboard 看到投递成功。

---

## 验证清单（对照 spec §7）

- [x 计划覆盖] lint + build 全过 → Task 3/4/6
- [x 计划覆盖] 0004 migration 执行 → Task 5（用户跑）
- [x 计划覆盖] 本地 checkout → Waffo → 测试卡 → credits +5 → Task 7
- [x 计划覆盖] 防重复（resend 不重复加）→ Task 4
- [x 计划覆盖] `git grep creem` 无残留 → Task 6
- [x 计划覆盖] 生产端到端 → Task 7

---

## 风险与注意事项

1. **metadata 透传（§8 最大风险）**：Task 4 的 webhook 假设 `event.data.metadata.{payment_id,user_id,credits}` 存在。第一次 webhook 的 console 日志会证实。若不透传，改兜底（buyerEmail 找 user + productName 映射 credits + 认领最近 pending payment）。
2. **checkout 变量名冲突**：原代码 `const session = await auth()`（Clerk session）与 Waffo `session` 冲突。Task 3 Step 4 已注明改名 `waffoSession`。
3. **migration 0004 必须跑**：rename 列后，`payments.waffo_session_id` 才存在。Task 7 Step 3 用户跑。
4. **webhook test mode**：Waffo dashboard webhook 配 test mode（test key 环境）。生产切 live key + prod webhook。
5. **测试卡**：成功 `4576 7500 0000 0110`（Visa），失败 `4576 7500 0000 0220`。任意未来有效期 + 任意 CVC。
6. **PEM key 格式**：escaped `\n`（SDK auto-normalize）。CI/CD 可用 base64（`WAFFO_PRIVATE_KEY_BASE64` + 代码 Buffer.decode，spec 提及，MVP 用 escaped）。
7. **前端零改动**：PricingCards / PaymentFeedback / tattoo-generator 都不动。`/api/checkout` 契约 `{url}` 不变。
