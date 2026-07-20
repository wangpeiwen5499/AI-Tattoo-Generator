# Day 5 Stripe 支付设计

> **日期**：2026-07-20
> **范围**：MVP Day 5 — 用户能购买 credits（3 档定价 + Stripe Checkout + Webhook 发放）
> **依赖**：Day 1-4 已完成（Clerk 用户 + Supabase payments/users 表 + add_credits RPC）
> **下一步**：实施计划由 writing-plans skill 生成

---

## 1. 背景与目标

Day 4 已经跑通完整的"上传 → 生成 → 看结果"用户体验。免费 1 次额度用完后，用户必须有付费入口才能继续。Day 5 上线 3 档 credits 购买：$4.99/5 次、$14.99/20 次、$29.99/50 次。

**核心闭环**：
```
用户 credits=0 → 点 Generate → toast 提示 → 点 navbar "Buy Credits"
  → /pricing 选档 → 跳 Stripe Checkout → 测试卡 4242 支付
  → Stripe webhook → add_credits → 回站点 credits+N
```

**不在 Day 5 范围**：
- Stripe Customer Portal / 订阅制 / 退款流程 / coupon
- 定价 A/B 测试 / FAQ / 营销文案
- 多币种（只 USD）
- 保存卡片复用（Stripe Checkout 默认不保存）

---

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| Checkout 模式 | **Hosted**（跳转 Stripe 托管页） | 比 Embedded 简单 5 倍，UX 已足够，Vercel 域名无需额外配置 |
| Product 管理 | **不用预建**（用 `price_data` 内联） | `CREDIT_PACKAGES` 已在代码里，避免 Dashboard 与代码双源 |
| Customer email | **预填 Clerk user email**（可改） | 用户少输一次，仍允许 Stripe 收集 |
| 防重复发放 | **DB unique + 应用层 status 检查** | `payments.stripe_session_id` 已 unique；webhook 进来先查 status，paid 直接 200 |
| Success 反馈 | **回 /?success=true + toast + 刷新 credits** | 已登录会自动 fetch /api/credits；toast 确认付款成功 |
| Cancel 反馈 | **回 /pricing?canceled=true + toast** | 友好提示，不强迫 |
| credits=0 时的入口 | **toast 文字带"Buy Credits"按钮** | 当前 Day 4 只 toast，Day 5 把按钮接上 `/pricing` |

---

## 3. 架构方案

```
┌─────────────┐    1. POST /api/checkout          ┌──────────────────┐
│  /pricing   │ ─────────────────────────────────▶│ Stripe Checkout  │
│ 3 档卡片    │                                   │ Session (hosted) │
└─────────────┘ ◀───────────────────────────────── └──────────────────┘
       │          2. 返回 { url } → 跳转                          │
       │                                                          │ 3. 用户输卡
       │                                                          │    4242 4242...
       │                                                          ▼
       │                                          ┌──────────────────────────┐
       │                                          │ Stripe 服务器            │
       │                                          │ 扣款 → 触发 webhook      │
       │                                          └──────────────────────────┘
       │                                                          │
       │                       4. POST /api/stripe-webhook        │
       │                       (Stripe 签名)                      ▼
       │                                          ┌──────────────────────────┐
       │                                          │ 1. 验签                  │
       │                                          │ 2. 查 payments.status    │
       │                                          │ 3. UPDATE paid + add_credits │
       │                                          └──────────────────────────┘
       │                                                          │
       ◀──────────────── 5. 跳回 /?success=true ──────────────────┘
                       (浏览器 sees success → toast → 刷新徽章)
```

**单页 + 5 个 API/组件文件**：
- `src/lib/stripe.ts` — Stripe SDK 单例
- `src/app/api/checkout/route.ts` — 创建 Session
- `src/app/api/stripe-webhook/route.ts` — Webhook 处理
- `src/app/pricing/page.tsx` — Server Component，渲染卡片
- `src/components/pricing-cards.tsx` — Client Component，发起购买

---

## 4. 文件清单

```
src/
├── lib/
│   └── stripe.ts                            # 新：Stripe SDK 单例 + 配置
├── app/
│   ├── pricing/
│   │   └── page.tsx                         # 新：定价页（Server Component）
│   └── api/
│       ├── checkout/
│       │   └── route.ts                     # 新：POST 创建 Stripe Session
│       └── stripe-webhook/
│           └── route.ts                     # 新：POST 接收 Stripe webhook
├── components/
│   ├── pricing-cards.tsx                    # 新：3 档卡片 + 点击购买
│   └── navbar.tsx                           # 改：Buy Credits 链接已存在（Day 1），无需改
├── hooks/
│   └── use-generation.ts                    # 改：credits=0 时 toast 加"Buy Credits"按钮
└── types/
    └── index.ts                             # 改：补 CheckoutResponse / PackageId
```

**未做的事（YAGNI）**：
- 不做 `/api/checkout/success` 单独路由（直接用 `/?success=true`）
- 不做客户化的 Stripe Checkout 样式（默认样式足够）
- 不做 webhook 重试队列（依赖 Stripe 自动重试 + DB unique）
- 不做生产/开发环境区分（用 `process.env.NODE_ENV` 切 URL）

---

## 5. 数据流

### 5.1 购买流程

```
1. 用户在 /pricing 点 "Buy" 按钮（packageId='popular'）
2. fetch POST /api/checkout { packageId }
3. API:
   a. auth() → userId + email
   b. ensureUser
   c. findPackageById(packageId) → 不存在 400
   d. INSERT payments (user_id, amount, credits_purchased, status='pending')
      注意：stripe_session_id 暂用占位 `pending_${payment.id}_${timestamp}`
      （因为 NOT NULL UNIQUE，需先有值）
   e. stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: email,
        line_items: [{ price_data: { currency:'usd', product_data:{name}, unit_amount: priceUsdCents }, quantity:1 }],
        success_url: `${origin}/?success=true`,
        cancel_url: `${origin}/pricing?canceled=true`,
        metadata: { user_id, payment_id, credits: String(credits) }
      })
   f. UPDATE payments set stripe_session_id = session.id where id = payment.id
   g. return { url: session.url }
4. 客户端 window.location.href = url → 跳转 Stripe
```

### 5.2 Webhook 流程

```
Stripe POST /api/stripe-webhook (raw body + stripe-signature header)

1. 读 raw body（Next.js 16 用 await request.text()）
2. stripe.webhooks.constructEvent(body, signature, endpointSecret)
   → 签名失败：return 400
3. switch event.type:
   case 'checkout.session.completed':
     session = event.data.object
     payment_id = session.metadata?.payment_id
     credits = Number(session.metadata?.credits)
     user_id = session.metadata?.user_id

     // 防重复：先查 payments 状态
     const { data } = await supabase.from('payments').select('status').eq('id', payment_id).single()
     if (!data) return 200 (payment 不存在，但已 ack 避免重试)
     if (data.status === 'paid') return 200 (已处理，幂等)

     // 更新 + 发放
     await supabase.from('payments').update({
       status: 'paid',
       paid_at: new Date().toISOString(),
       stripe_payment_intent: session.payment_intent
     }).eq('id', payment_id)
     await supabase.rpc('add_credits', { p_user_id: user_id, p_amount: credits })

   case 'checkout.session.async_payment_failed':
     // 等异步支付（iDEAL/sepa）失败
     UPDATE payments set status='failed' where payment_id

   default: ignore
4. return 200
```

**关键**：所有 webhook 都返回 200（除非验签失败），避免 Stripe 重试。
出错的 webhook 记录日志，但不返回 500（重试也救不回来）。

---

## 6. API 路由规范

### 6.1 `POST /api/checkout`

```
鉴权：Clerk session（无 → 401）
请求体：{ packageId: 'starter' | 'popular' | 'pro' }
响应：
  200 { url: string }            // Stripe Checkout URL
  400 { error: 'Invalid package' }
  401 { error: 'Unauthorized' }
  500 { error: 'Internal error' }
```

### 6.2 `POST /api/stripe-webhook`

```
鉴权：Stripe 签名（无 Clerk 鉴权）
请求体：raw body（Stripe 格式）
响应：
  200 {}                        // 所有正常情况
  400 { error: 'Invalid signature' }
```

**注意**：Next.js 16 默认会 parse JSON body，需要在 route 里强制读 raw：
```ts
export async function POST(req: Request) {
  const body = await req.text()  // 不要 req.json()
  const sig = req.headers.get('stripe-signature')!
  // ...
}
```

---

## 7. 类型定义（`src/types/index.ts`）

```typescript
export type PackageId = 'starter' | 'popular' | 'pro'

export interface CheckoutResponse {
  url: string
}

export interface CheckoutRequestBody {
  packageId: PackageId
}
```

---

## 8. 错误处理矩阵

| 场景 | HTTP | 处理 |
|---|---|---|
| 未登录点购买 | 401 | toast + 弹 SignIn modal |
| 无效 packageId | 400 | toast "Invalid package" |
| Stripe Session 创建失败 | 500 | toast "Checkout failed, please retry" + log |
| 用户关闭 Stripe 页面 | — | Stripe 跳回 cancel_url → /pricing?canceled=true → toast |
| Webhook 验签失败 | 400 | log + return 400（让 Stripe 不重试） |
| Webhook metadata 缺 payment_id | 200 | log + return 200（避免重试） |
| Webhook payment_id 不存在 | 200 | 同上 |
| Webhook status 已 paid | 200 | 幂等返回 |
| add_credits RPC 失败 | 500 | return 500（让 Stripe 重试） |
| 用户支付时刷新页面 | — | Stripe 保持 session，回来仍能完成 |

---

## 9. UI 设计

### 9.1 桌面端 /pricing（max-w-5xl）

```
┌─────────────────────────────────────────────────────────┐
│  Navbar                          [Credits: 0] [Buy] 👤 │
├─────────────────────────────────────────────────────────┤
│         Choose Your Credits Package                     │
│         One-time payment · No subscription              │
│                                                         │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐            │
│  │ Starter  │   │★ Most    │   │  Pro     │            │
│  │          │   │  Popular │   │          │            │
│  │  $4.99   │   │  $14.99  │   │  $29.99  │            │
│  │          │   │          │   │          │            │
│  │  5       │   │  20      │   │  50      │            │
│  │  credits │   │  credits │   │  credits │            │
│  │          │   │          │   │          │            │
│  │ $0.99/ea │   │ $0.75/ea │   │ $0.60/ea │            │
│  │          │   │          │   │          │            │
│  │ [Get    ]│   │ [Get    ]│   │ [Get    ]│            │
│  └──────────┘   └──────────┘   └──────────┘            │
│                                                         │
│         🔒 Secured by Stripe · Test mode                │
└─────────────────────────────────────────────────────────┘
```

- 3 列响应式 grid（移动端单列堆叠）
- "Most Popular" 卡片：`border-primary border-2` + `scale-105` + 顶部标签
- 价格大字号 `text-4xl font-bold`
- 单价小字号 `text-sm text-muted-foreground`
- 按钮：`<Button variant={highlighted ? 'default' : 'outline'} size="lg">`

### 9.2 已登录 vs 未登录

- **已登录**：按钮可点，点击 → fetch /api/checkout → 跳转
- **未登录**：按钮文字改为"Sign in to buy"，点击 → 弹 SignIn modal（复用 Clerk `<SignInButton mode="modal">`）

### 9.3 Success/Canceled 反馈

- `/` with `?success=true`：useCredits 自动 fetch（Day 4 已实现挂载时拉取），徽章数字+N。额外弹 toast "Payment successful! {N} credits added"
- `/pricing` with `?canceled=true`：toast "Checkout canceled"（无错误红色，灰色中性）

实现方式：在 `PricingCards` 和 `<TattooGenerator>` 顶层用 `useSearchParams` 监听查询参数 → toast → `router.replace` 清理 URL

### 9.4 credits=0 toast 升级（Day 4 修复）

当前 Day 4 `useGeneration` 在 credits=0 时 `toast("Out of credits")`。Day 5 改为：

```tsx
toast("Out of credits", {
  description: "Buy credits to continue",
  action: { label: "Buy Credits", onClick: () => router.push('/pricing') }
})
```

---

## 10. 本地测试流程

### 10.1 启动 Stripe CLI 监听

```bash
# 一次性安装 Stripe CLI（Windows 可下载 exe 放 PATH）
stripe login

# 启动 webhook 转发（前台运行，会打印 webhook signing secret）
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

输出：`> Ready! Your webhook signing secret is whsec_xxxxxxxx`

把 `whsec_xxxxxxxx` 填到 `.env.local` 的 `STRIPE_WEBHOOK_SECRET`。

### 10.2 端到端测试步骤

1. 登录后访问 /pricing
2. 点 "Most Popular" → 跳转 Stripe Checkout
3. 输入测试卡：
   - 卡号：`4242 4242 4242 4242`
   - 有效期：任意未来日期（如 `12/30`）
   - CVC：任意 3 位（如 `123`）
   - 邮编：任意（如 `12345`）
4. 点击 Subscribe / Pay
5. 跳回 `/?success=true`
6. 检查：
   - toast "Payment successful! 20 credits added"
   - Credits 徽章从 0 变成 20
   - `stripe listen` 终端打印 `checkout.session.completed`
   - 数据库 payments 表有一条 status='paid' 记录
7. 重复点 Generate → 正常生成

### 10.3 防重复测试

```bash
# 在 stripe listen 终端会自动重试失败 webhook
# 手动测试：直接 curl 同一个事件两次（用 Stripe CLI 的 trigger）
stripe trigger checkout.session.completed
# 检查 credits 只增加了 1 次
```

---

## 11. 风险与备注

| 风险 | 影响 | 应对 |
|---|---|---|
| Stripe webhook 签名密钥泄漏 | 别人能伪造 webhook 加 credits | 密钥只在服务端，不入 git；Vercel 环境变量加密存储 |
| metadata 字段被人为篡改 | 用户给自己加 credits | 不可能：metadata 是 API 创建时写入，用户无法改 |
| 用户支付时关闭浏览器 | payments 永远 pending | 不影响功能；可加 cron 清理 >7 天 pending（Day 6/7 加） |
| Stripe 服务故障 | 不能付费 | Stripe SLA 99.99%，故障时 toast "Checkout unavailable" |
| 用户付了款但跳转失败 | credits 已到账但 UI 不知道 | useCredits 挂载时拉取；用户下次进站点就看到 |
| 测试模式残留到生产 | 用户被收费 | 部署前确认 STRIPE_SECRET_KEY 是 `sk_live_` 不是 `sk_test_` |
| 部署到 Vercel 后 webhook URL 没改 | 生产付费不发放 credits | Day 7 部署清单加一项：Stripe Dashboard 配置 webhook endpoint |

---

## 12. 验收标准

- [ ] 访问 `/pricing` 显示 3 档定价卡片，"Most Popular" 高亮
- [ ] 未登录点按钮 → 弹 SignIn modal（不跳转）
- [ ] 已登录点按钮 → 跳转 Stripe Checkout
- [ ] 输入测试卡 `4242 4242 4242 4242` 支付成功
- [ ] `stripe listen` 终端打印 `checkout.session.completed`
- [ ] 浏览器跳回 `/?success=true` → toast + credits 徽章 +N
- [ ] 数据库 payments 表新增 1 条 status='paid' 记录
- [ ] 数据库 users 表 credits 列正确 +N
- [ ] 重复 webhook 不重复发放（curl 同事件两次，credits 只 +1 次）
- [ ] 关闭 Stripe 页面 → 跳回 `/pricing?canceled=true` + toast
- [ ] credits=0 时点 Generate → toast 含"Buy Credits"按钮，点击跳 /pricing

---

## 13. 未做的事（YAGNI 清单）

- Stripe Customer Portal（用户管理卡片/查看历史发票）
- 订阅制（只做一次性买断）
- 退款 UI（手动 Dashboard 操作，不在产品内做）
- Coupon / 促销码
- Stripe Tax（自动税务）
- 保存卡片复用（Stripe 默认不保存）
- 多币种（只 USD）
- Apple Pay / Google Pay（Stripe 默认会显示，无需特别做）
- 邮件通知付款成功（Stripe 默认发）
- 定价 FAQ / 用户评价 / 对比表
- A/B 测试不同定价
- 礼物卡 / 推荐返利

---

## 14. 下一步

调用 `superpowers:writing-plans` skill 把这份设计转成可逐步执行的实施计划。
