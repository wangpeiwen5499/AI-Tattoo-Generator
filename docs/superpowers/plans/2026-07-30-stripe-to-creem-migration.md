# Stripe → Creem 支付迁移 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把支付通道从 Stripe 切换到 Creem.io（Merchant of Record），保持 credits 制一次性买断商业模式与所有非支付逻辑不变。

**Architecture:** 沿用现有「选档 → /api/checkout 创建会话 → 跳转托管页 → webhook 发放 credits」闭环，只替换支付通道。用官方 TS SDK `creem`（自动切 test/live endpoint + 自带验签 helper）。彻底删除 Stripe 代码与依赖。

**Tech Stack:** Next.js 16 App Router、React 19、Supabase（service_role）、Creem SDK（`creem` 包）、Clerk、TypeScript。

## Global Constraints

- **中文回答 + 中文 commit message**（见 CLAUDE.md）。
- 每个 commit 结尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **MVP 不用测试框架**（无 jest/vitest），验证靠 `npm run build` + `npm run lint` + curl + 浏览器手动测试（与 Day 5/6 一致）。
- Creem 保持 **Test Mode**：SDK `server: "test"`（非 production）。
- 货币 **USD**，定价不变（$4.99 / $14.99 / $29.99）。
- **接口契约不变**：`POST /api/checkout` 仍返回 `{ url }`，前端 `pricing-cards.tsx` 取 `data.url` 的逻辑不动。
- 服务端密钥（`CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET`）只进 `.env.local` / Vercel，不入 git。
- 直接在 `main` 分支实施，每个 task 一个 commit。

## File Structure

| 操作 | 文件 | 责任 |
|---|---|---|
| 改 | `package.json` | 卸 `stripe`，装 `creem` |
| 改 | `.gitignore` | 移除 `stripe.exe` 条目 |
| 新建 | `src/lib/creem.ts` | Creem SDK lazy 单例 |
| 新建 | `supabase/migrations/0002_creem.sql` | rename payments 列（`0001` 保持不动，见 Task 3） |
| 改 | `src/lib/constants.ts` | `CreditPackage` 加 `creemProductId` |
| 改 | `src/types/index.ts` | `PaymentRow` 两列改名 |
| 重写 | `src/app/api/checkout/route.ts` | 用 `productId` 创建 Creem 会话 |
| 新建 | `src/app/api/creem-webhook/route.ts` | Creem webhook 验签 + 发放 |
| 删 | `src/app/api/stripe-webhook/route.ts` | Stripe webhook |
| 删 | `src/lib/stripe.ts` | Stripe SDK 单例 |
| 改 | `src/components/payment-feedback.tsx` | 方案 A：纯 toast，不依赖 `credits=N` |
| 改 | `src/components/pricing-cards.tsx` | 注释/错误文案 Stripe→Creem |
| 改 | `src/app/pricing/page.tsx` | 底部文案 |
| 改 | `.env.example` | `STRIPE_*` → `CREEM_*`（占位） |

> **`src/components/credits-badge.tsx` 不改**：方案 A 下付款跳回首页，`TattooGenerator` 重新挂载 → `useCredits` 自动 fetch 新余额 → `CreditsBadge` 收新 props 显示正确数字。其 `credits:added` 监听虽不再被触发（无害死代码），但同实例 count-up 动画仍服务于「生成消耗 credit」场景。这是对 spec §9 的简化细化。

---

## Task 1: 装 Creem SDK + 清理 .gitignore

**Files:**
- Modify: `package.json`（装 `creem`，**暂不卸 `stripe`**——卸载放 Task 5 与代码切换同步，避免中间 build 断）
- Modify: `.gitignore`

**Interfaces:** 无（基础设施）

- [ ] **Step 1: 安装 creem 包**

```bash
npm install creem
```

- [ ] **Step 2: 移除 .gitignore 里的 stripe.exe 条目**

打开 `.gitignore`，找到并删除含 `stripe.exe` 的行（Stripe CLI Windows 残留）。其余条目不动。

- [ ] **Step 3: 验证 build 仍通过**

```bash
npm run build
```
Expected: 构建成功（`creem` 装了但未引用，`stripe` 仍在，无破坏）。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: 装 Creem SDK，清理 .gitignore 的 stripe.exe" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: 新建 lib/creem.ts（Creem SDK 单例）

**Files:**
- Create: `src/lib/creem.ts`

**Interfaces:**
- Produces: `getCreem(): Creem`（lazy 单例，被 Task 5 的 checkout/webhook 使用）

- [ ] **Step 1: 创建文件 `src/lib/creem.ts`**

```ts
import { Creem } from 'creem'

/**
 * Creem 服务端单例（替换 lib/stripe.ts）。
 *
 * ⚠️ 只在服务端代码（API Route / server actions）中 import，
 * 不要 import 到任何 'use client' 文件或 middleware。
 *
 * CREEM_API_KEY 从 .env.local 读（test: creem_test_...，live: creem_...）。
 * server: test mode 用 'test'（指向 test-api.creem.io），生产省略（默认 api.creem.io）。
 */
function createCreemClient(): Creem {
  const apiKey = process.env.CREEM_API_KEY
  if (!apiKey) {
    throw new Error('CREEM_API_KEY is not set. Add it to .env.local')
  }
  return new Creem({
    apiKey,
    server: process.env.NODE_ENV === 'production' ? undefined : 'test',
  })
}

// Lazy 全局单例，避免每次调用都新建 client
let _creem: Creem | null = null
export function getCreem(): Creem {
  if (!_creem) _creem = createCreemClient()
  return _creem
}
```

- [ ] **Step 2: 验证 build 通过**

```bash
npm run build
```
Expected: 成功（新文件未被引用，无破坏）。

- [ ] **Step 3: Commit**

```bash
git add src/lib/creem.ts
git commit -m "feat: 添加 Creem SDK 服务端单例" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: DB migration 0002 + 更新 0001 注释

**Files:**
- Create: `supabase/migrations/0002_creem.sql`
- Modify: `supabase/migrations/0001_init.sql`（仅注释，源文件留档）

**Interfaces:** 无（DB 层）

> ⚠️ 此 task 包含一步**人工操作**：在 Supabase Dashboard 执行 SQL。执行前先备份（虽然无真实数据）。

- [ ] **Step 1: 创建 `supabase/migrations/0002_creem.sql`**

```sql
-- 0002: payments 表 Stripe 列重命名为 Creem
-- 在 Supabase Dashboard > SQL Editor 中执行此文件
-- UNIQUE 约束由 Postgres 自动保留；idx_payments_user_id 不涉及这两列，不动

alter table public.payments rename column stripe_session_id     to creem_checkout_id;
alter table public.payments rename column stripe_payment_intent to creem_order_id;
```

> **`0001_init.sql` 不动**：已执行的 migration 是历史快照，保持原样。全新环境按 0001（建 `stripe_*` 列）→ 0002（rename 成 `creem_*`）顺序执行即自洽；若改 0001 的列名，重跑「0001+0002」时 0002 的 rename 会找不到源列而报错。

- [ ] **Step 2: 人工执行——在 Supabase 执行 0002**

打开 Supabase Dashboard → SQL Editor → 新 query → 粘贴 0002_creem.sql 内容 → Run。确认无报错。

- [ ] **Step 3: 人工验证——列已改名**

在 Supabase Table Editor 打开 `payments` 表，确认列名是 `creem_checkout_id` / `creem_order_id`（不再是 `stripe_*`）。旧测试行的值会自动跟随到新列名。

- [ ] **Step 4: 验证 build 通过**

```bash
npm run build
```
Expected: 成功（SQL 不影响 TS 编译）。

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_creem.sql
git commit -m "feat: payments 表 Stripe 列重命名为 Creem（0002 migration）" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: constants.ts 加 creemProductId 字段

**Files:**
- Modify: `src/lib/constants.ts`

**Interfaces:**
- Produces: `CreditPackage.creemProductId: string`（环境变量名，如 `'CREEM_PRODUCT_STARTER'`，被 Task 5 checkout 使用）

- [ ] **Step 1: 给 `CreditPackage` 接口加字段**

在 `src/lib/constants.ts` 的 `CreditPackage` interface 里，`description` 后加：

```ts
  /** 该档位对应的 Creem product 环境变量名（值在 .env.local，如 CREEM_PRODUCT_STARTER） */
  creemProductId: string
```

- [ ] **Step 2: 给 3 个 package 各加 creemProductId**

`starter` 对象加 `creemProductId: 'CREEM_PRODUCT_STARTER',`；`popular` 加 `creemProductId: 'CREEM_PRODUCT_POPULAR',`；`pro` 加 `creemProductId: 'CREEM_PRODUCT_PRO',`。加在各自 `description` 之后。

改完后 `CREDIT_PACKAGES` 形如：

```ts
export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    priceUsdCents: 499,
    description: '5 tattoo previews',
    creemProductId: 'CREEM_PRODUCT_STARTER',
  },
  {
    id: 'popular',
    name: 'Most Popular',
    credits: 20,
    priceUsdCents: 1499,
    description: '20 tattoo previews · Best value per preview',
    creemProductId: 'CREEM_PRODUCT_POPULAR',
    highlighted: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 50,
    priceUsdCents: 2999,
    description: '50 tattoo previews · For serious shoppers',
    creemProductId: 'CREEM_PRODUCT_PRO',
  },
]
```

- [ ] **Step 3: 验证 build + lint 通过**

```bash
npm run build && npm run lint
```
Expected: 成功（加可选字段，现有代码不破坏；`creemProductId` 是必填字段但现有引用方只读其他字段，不受影响）。

- [ ] **Step 4: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat: CreditPackage 加 creemProductId 字段" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: 支付通道切换（核心原子 task）

> 这是迁移的核心。把 Stripe 的 checkout/webhook 一次性替换为 Creem，同时改 types 列名、删 Stripe 文件、卸 stripe 包。**一个 commit 完成所有切换**，确保切换后 build 通过（中间不 commit 半切状态）。

**Files:**
- Rewrite: `src/app/api/checkout/route.ts`
- Create: `src/app/api/creem-webhook/route.ts`
- Modify: `src/types/index.ts`（PaymentRow 改名）
- Delete: `src/app/api/stripe-webhook/route.ts`
- Delete: `src/lib/stripe.ts`
- Modify: `package.json`（卸 `stripe`）

**Interfaces:**
- Consumes: `getCreem()`（Task 2）、`CreditPackage.creemProductId`（Task 4）
- Produces: `POST /api/checkout` → `{ url }`（契约不变）；`POST /api/creem-webhook`（Creem 验签）

- [ ] **Step 1: 重写 `src/app/api/checkout/route.ts`**

完整替换为：

```ts
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
```

- [ ] **Step 2: 新建 `src/app/api/creem-webhook/route.ts`**

```ts
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
```

- [ ] **Step 3: 改 `src/types/index.ts` 的 PaymentRow**

把：

```ts
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
```

改为：

```ts
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
```

- [ ] **Step 4: 删除 Stripe 文件**

```bash
rm src/lib/stripe.ts src/app/api/stripe-webhook/route.ts
# 如果 stripe-webhook 目录因此空了，也删掉空目录
rmdir src/app/api/stripe-webhook 2>/dev/null || true
```

- [ ] **Step 5: 卸载 stripe 包**

```bash
npm uninstall stripe
```

- [ ] **Step 6: 验证 build + lint 通过**

```bash
npm run build && npm run lint
```
Expected: 成功。此时所有 Stripe 引用已消失：checkout 用 `getCreem()`、creem-webhook 用 `creem/webhooks`、types 用 `creem_checkout_id`/`creem_order_id`、stripe.ts/stripe-webhook 已删、stripe 包已卸。

> 若 build 报「Cannot find module 'stripe'」或「stripe_session_id」之类，说明有遗漏的 Stripe 引用，全局搜 `stripe`（忽略大小写）逐一处理。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: 支付通道从 Stripe 切换到 Creem" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: 前端适配（payment-feedback 方案 A + 文案）

**Files:**
- Modify: `src/components/payment-feedback.tsx`
- Modify: `src/components/pricing-cards.tsx`
- Modify: `src/app/pricing/page.tsx`

**Interfaces:** 无（UI 层，接口契约不变）

- [ ] **Step 1: 简化 `src/components/payment-feedback.tsx`（方案 A）**

完整替换为：

```tsx
'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

/**
 * 监听 URL 查询参数 ?success=true，显示付款成功 toast，然后清理 URL。
 *
 * 方案 A（Creem 迁移）：Creem 跳回 /?success=true&checkout_id=...（无 credits=N），
 * 故只用通用 toast；余额更新靠首页重新挂载时 useCredits 自动 fetch
 * （TattooGenerator 持有 useCredits，重新挂载即拉新余额）。
 * 不再 dispatch credits:added（无精确 amount，CreditsBadge 靠重新挂载显示新值）。
 *
 * 渲染为 null，纯副作用组件。
 * ⚠️ 必须在 Suspense 边界内使用（Next.js 16 + useSearchParams 强制要求）。
 */
export function PaymentFeedback() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('success') !== 'true') return

    toast.success('Payment successful!', {
      description: 'Your credits have been added.',
    })

    // 清理 URL（移除 ?success=true，避免刷新重复弹 toast）
    router.replace('/')
  }, [searchParams, router])

  return null
}
```

- [ ] **Step 2: 改 `src/components/pricing-cards.tsx` 的注释与错误文案**

在 `handleBuy` 里，把：

```ts
      if (!data.url) throw new Error('Stripe returned no URL')
      // 跳转 Stripe Checkout（同窗口，用 assign 避免 react-hooks/immutability 报警）
      window.location.assign(data.url)
```

改为：

```ts
      if (!data.url) throw new Error('Checkout returned no URL')
      // 跳转 Creem 托管页（同窗口，用 assign 避免 react-hooks/immutability 报警）
      window.location.assign(data.url)
```

同时把文件顶部 JSDoc 里的 `跳转 Stripe` 改为 `跳转 Creem 托管页`。

- [ ] **Step 3: 改 `src/app/pricing/page.tsx` 底部文案**

把：

```tsx
      <p className="mx-auto mt-12 max-w-xl text-center text-sm text-muted-foreground">
        🔒 Secured by Stripe · Test mode — no real charges
      </p>
```

改为：

```tsx
      <p className="mx-auto mt-12 max-w-xl text-center text-sm text-muted-foreground">
        🔒 Secured by Creem · Test mode — no real charges
      </p>
```

- [ ] **Step 4: 验证 build + lint 通过**

```bash
npm run build && npm run lint
```
Expected: 成功。

- [ ] **Step 5: Commit**

```bash
git add src/components/payment-feedback.tsx src/components/pricing-cards.tsx src/app/pricing/page.tsx
git commit -m "feat: 前端适配 Creem（文案 + 成功反馈方案 A）" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: 更新 .env.example

**Files:**
- Modify: `.env.example`

**Interfaces:** 无

- [ ] **Step 1: 替换 .env.example 的 Stripe 段为 Creem 段**

把：

```bash
# ============================================
# Stripe（Day 5 需要）
# 从 https://dashboard.stripe.com/apikeys 获取
# ============================================
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

改为：

```bash
# ============================================
# Creem 支付（替换 Stripe，Test Mode）
# dashboard: https://creem.io （左下角 Test Mode 保持开启）
# API key: Developers > API Keys
# webhook secret: Developers > Webhooks 注册 endpoint 后生成
# product id: Products 里创建 one-time product 后复制（3 档各一个）
# ============================================
CREEM_API_KEY=creem_test_xxx
CREEM_WEBHOOK_SECRET=whsec_xxx
CREEM_PRODUCT_STARTER=prod_xxx
CREEM_PRODUCT_POPULAR=prod_xxx
CREEM_PRODUCT_PRO=prod_xxx
```

- [ ] **Step 2: 验证 build 通过**

```bash
npm run build
```
Expected: 成功（`.env.example` 不影响运行时）。

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: .env.example 切换为 Creem 环境变量" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: 端到端验证

> 此 task **依赖前置人工操作**：必须先完成 Creem dashboard 第 3 件事——`ngrok http 3000` + 注册 dev webhook endpoint，把生成的 `CREEM_WEBHOOK_SECRET` 填进 `.env.local`，重启 dev server。没有它，webhook 发放测不通。

**Files:** 无（纯验证）

- [ ] **Step 1: 确认 .env.local 的 Creem 变量齐全**

`.env.local` 应有（前 4 个已填，第 5 个填 ngrok 拿到的 secret）：
```
CREEM_API_KEY=creem_test_...        ✅ 已填
CREEM_PRODUCT_STARTER=prod_...      ✅ 已填
CREEM_PRODUCT_POPULAR=prod_...      ✅ 已填
CREEM_PRODUCT_PRO=prod_...          ✅ 已填
CREEM_WEBHOOK_SECRET=whsec_...      ⬅ 本次填
```

- [ ] **Step 2: 启动 dev server + ngrok**

终端 A：
```bash
npm run dev
```
终端 B：
```bash
ngrok http 3000
```
复制 ngrok 给的 `https://<random>.ngrok.io`。

- [ ] **Step 3: 注册 dev webhook endpoint（Creem dashboard）**

Developers → Webhooks → Add Endpoint → URL 填 `https://<random>.ngrok.io/api/creem-webhook` → 保存 → 复制生成的 `whsec_...` → 填进 `.env.local` 的 `CREEM_WEBHOOK_SECRET` → 重启 dev server（终端 A 停掉重跑 `npm run dev`）。

- [ ] **Step 4: 浏览器端到端——成功路径**

1. 访问 `http://localhost:3000`，登录
2. 点 navbar 「Buy Credits」→ `/pricing`
3. 点 「Most Popular」→ 跳转 Creem 托管页
4. 用 **Creem dashboard Test Mode 显示的测试卡号**付款（卡号以后台为准，任意未来有效期 + 任意 CVC）
5. 跳回 `/?success=true` → 看到 toast「Payment successful!」
6. 点「Generate」或刷新 → credits 徽章显示新余额（应为原值 +20）
7. Supabase `payments` 表新增一行 `status='paid'`、`creem_checkout_id`（`ch_...`）、`creem_order_id`（`ord_...`）有值

Expected: 全部通过。

- [ ] **Step 5: 防重复测试**

在 Creem dashboard 找到刚才那条 `checkout.completed` 事件 → 点 Resend。dev server 终端应打印 `[creem-webhook] payment already paid, skipping: ...`，且 `users.credits` **不重复增加**。

Expected: credits 只加一次。

- [ ] **Step 6: 验签失败测试**

临时把 `.env.local` 的 `CREEM_WEBHOOK_SECRET` 改一个字符 → 重启 dev server → 在 dashboard Resend 事件 → 终端打印 `signature verification failed` → 返回 401。改回正确 secret。

Expected: 验签失败返回 401，不发放。

- [ ] **Step 7: 错误路径测试**

浏览器 DevTools Console（已登录态）：
```js
fetch('/api/checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ packageId: 'invalid' }) }).then(r => r.status).then(console.log)
```
Expected: `400`。

未登录直接访问受保护行为 → 401（Clerk middleware 拦截）。

- [ ] **Step 8: 最终 build + lint**

```bash
npm run build && npm run lint
```
Expected: 全绿（Next.js 16 middleware 弃用警告属已知项，正常）。

- [ ] **Step 9: 收尾**

验证全过后，本 task 不产生代码 commit（纯验证）。更新 `docs/handoff.md` 记录迁移完成（可选，单独一个 docs commit）。

---

## 验证总览

| 验证点 | 命令/操作 | 期望 |
|---|---|---|
| 编译 | `npm run build` | 成功 |
| Lint | `npm run lint` | 成功 |
| 购买→发放 | 浏览器端到端（Step 4） | credits +N，payments 表 paid |
| 防重复 | dashboard Resend（Step 5） | 不重复发放 |
| 验签 | 错误 secret（Step 6） | 401 |
| 无效 packageId | curl（Step 7） | 400 |
| 全局无 stripe 残留 | `grep -ri stripe src/` | 仅注释/文案无（或确认无害） |

## 回滚

- 任一 task 出问题：`git revert <commit>` 回退该步。
- 整体回滚：revert Task 5 的切换 commit 即可恢复 Stripe（前提：Task 3 的 DB rename 需手动反向 rename，因无真实数据可不管）。
