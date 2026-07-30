# Stripe → Creem 支付迁移设计

> **日期**：2026-07-30
> **范围**：把支付通道从 Stripe 迁移到 Creem.io（Merchant of Record），保持 credits 制一次性买断商业模式不变
> **依赖**：Day 5 Stripe 支付已实现（commit 范围 `de80391`~`20c00a0`）
> **下一步**：实施计划由 `superpowers:writing-plans` skill 生成

---

## 1. 背景与目标

用户决定把支付提供商从 Stripe 换成 **Creem.io**（Merchant of Record 平台，自动处理全球税务合规）。

**迁移目标**：在保持现有「选档 → 创建会话 → 跳转托管页 → webhook 发放 credits」闭环**完全不变**的前提下，**只替换支付通道**。所有非支付逻辑（credits 扣减/退还、生成流程、历史记录、上传）零改动。

**商业模式不变**：Credits 制一次性买断，3 档 $4.99 / $14.99 / $29.99，注册送 1 次，Credits 永不过期。货币 USD。

**为什么是「彻底替换」而非「并存」**：项目处于 Day 7 前夕、尚未上线、**无真实 Stripe 付费用户**（DB `payments` 表最多只有 Day 5 测试卡数据）。双支付并存会引入两套 webhook、两套 DB 列、两套 product 管理，严重违反 YAGNI，故采用方案 A「彻底移除 Stripe」。

---

## 2. 关键决策

| 决策点 | 选择 | 理由 |
|---|---|---|
| 迁移策略 | **方案 A：彻底移除 Stripe** | 未上线、无真实用户；双套支付违反 YAGNI |
| 客户端集成 | **官方 TS SDK `creem`** | 自动切 test/live endpoint、自带验签 helper（`constructWebhookEventEntity`）、完整类型 |
| 成功页动效 | **方案 A：放弃精确 `+N`** | Creem 会向 `success_url` 追加自己的 query，无法再用 `?credits=N`；改通用 toast + `useCredits` 自动刷新（handoff 第 19 项踩过的坑不再复现） |
| 货币 | **USD** | 保持现有定价不变 |
| Test/Live 切换 | **SDK `server` 参数 + 环境变量 `product_id`** | `server:"test"` 切 endpoint；3 档 `prod_xxx` 走环境变量，代码不分支 |
| DB 列处理 | **rename（新建 0002 migration）** | 无真实数据，rename 比「新增列保留旧列」干净；UNIQUE 约束由 Postgres 自动保留 |
| 退款自动化 | **不做** | MVP 退款手动在 Creem dashboard 操作，不自动扣 credits |

---

## 3. Stripe vs Creem 关键差异

| 维度 | Stripe（现状） | Creem（迁移后） |
|---|---|---|
| 产品定义 | `price_data` 内联（代码传价格） | **必须先 dashboard 预建 product**，checkout 传 `product_id` |
| 创建会话 | `stripe.checkout.sessions.create({mode, line_items, price_data})` | `creem.checkouts.create({productId, successUrl, metadata, requestId, customer})` |
| 认证 | `Bearer` | `x-api-key`（SDK 内部处理） |
| 返回字段 | `session.url` | `checkout.checkoutUrl`（`id: ch_xxx`） |
| 成功跳转 | 自拼 `?success=true&credits=N` | Creem **追加** `?checkout_id=&order_id=&customer_id=&product_id=` |
| Test 环境 | `stripe listen` 本地转发 | **独立环境三件套**：`test-api.creem.io` + 独立 API key + 独立 product |
| Webhook 验签 | `stripe-signature`（`t=,v1=`） | `creem-signature`（HMAC-SHA256 hex），SDK `constructWebhookEventEntity` |
| 完成事件 | `checkout.session.completed` | `checkout.completed` |
| metadata 位置 | `session.metadata` | `object.metadata` |
| 税务 | 自理（或 Stripe Tax） | **MoR 自动收税 remit**（抽成会侵蚀毛利，见 §12 风险） |

---

## 4. 文件改动表

| 操作 | 文件 | 说明 |
|---|---|---|
| 🗑 删除 | `src/lib/stripe.ts` | Stripe SDK 单例 |
| 🗑 删除 | `src/app/api/stripe-webhook/route.ts` | Stripe webhook |
| ✨ 新建 | `src/lib/creem.ts` | Creem SDK 单例（`new Creem({apiKey, server:"test"})`） |
| ✨ 新建 | `src/app/api/creem-webhook/route.ts` | Creem webhook（`constructWebhookEventEntity` 验签） |
| ✨ 新建 | `supabase/migrations/0002_creem.sql` | rename `stripe_session_id`→`creem_checkout_id`、`stripe_payment_intent`→`creem_order_id` |
| ♻️ 重写 | `src/app/api/checkout/route.ts` | `price_data`→`productId`；返回 `checkout_url` |
| ✏️ 改 | `src/lib/constants.ts` | `CreditPackage` 加 `creemProductId`（环境变量名） |
| ✏️ 改 | `src/types/index.ts` | `PaymentRow` 两列改名 |
| ✏️ 改 | `src/components/pricing-cards.tsx` | 注释/错误文案 Stripe→Creem；跳转沿用 `window.location.assign`（handoff 第 17 项） |
| ✏️ 改 | `src/app/pricing/page.tsx` | 底部文案 "Secured by Stripe"→"Secured by Creem" |
| ✏️ 改 | `src/components/payment-feedback.tsx` | 方案 A：去掉 `credits=N` 依赖，通用 toast |
| ✏️ 改 | `.env.example` / `.env.local` / Vercel | `STRIPE_*`→`CREEM_*`（见 §10） |
| ✏️ 改 | `package.json` | 卸 `stripe`，装 `creem` |
| ✏️ 改 | `.gitignore` | 移除 `stripe.exe` 条目 |
| 🟰 不动 | `add_credits` / `deduct_credits` RPC、generate、history、上传、CreditsBadge 核心逻辑 | 非支付逻辑零改动 |

---

## 5. 后端核心三件套

### 5.1 `src/lib/creem.ts`（新建）

沿用现有 `getStripe()` 的 **lazy 单例** 模式，`server` 按 `NODE_ENV` 切：

```ts
import { Creem } from 'creem'

function createCreemClient(): Creem {
  const apiKey = process.env.CREEM_API_KEY
  if (!apiKey) throw new Error('CREEM_API_KEY is not set. Add it to .env.local')
  return new Creem({
    apiKey,
    server: process.env.NODE_ENV === 'production' ? undefined : 'test',
  })
}

let _creem: Creem | null = null
export function getCreem(): Creem {
  if (!_creem) _creem = createCreemClient()
  return _creem
}
```

### 5.2 `src/app/api/checkout/route.ts`（重写）

流程与现有 Stripe 版**一一对应**（Clerk 鉴权 → ensureUser → 校验 package → INSERT pending → 创建会话 → UPDATE id → 返回 url），只换创建会话那段：

```ts
const pkg = CREDIT_PACKAGES.find(p => p.id === packageId)
const productId = process.env[pkg.creemProductId]   // e.g. CREEM_PRODUCT_STARTER
if (!productId) return 500  // product 未配置

// INSERT payments（creem_checkout_id 先占位，因 NOT NULL UNIQUE）
const placeholder = `pending_${Date.now()}_${Math.random().toString(36).slice(2,10)}`

const checkout = await creem.checkouts.create({
  productId,
  successUrl: `${origin}/?success=true`,           // 方案 A：不带 credits=N
  customer: { email },
  requestId: paymentRow.id,                          // 双保险：webhook 可用 request_id 反查
  metadata: {
    user_id: session.userId,
    payment_id: paymentRow.id,
    credits: String(pkg.credits),
    package_id: pkg.id,
  },
})

// UPDATE payments.creem_checkout_id = checkout.id（ch_xxx）
// 返回——接口契约不变（前端仍取 data.url），前端无感：
return NextResponse.json<CheckoutResponse>({ url: checkout.checkoutUrl })
```

> `creemProductId` 在 `constants.ts` 存的是**环境变量名**（`'CREEM_PRODUCT_STARTER'`），不是 id 本身——test/live 切换不动代码。

### 5.3 `src/app/api/creem-webhook/route.ts`（新建）

验签 + 防重复 + 发放顺序**全部沿用现有 Stripe webhook**（先 RPC `add_credits` 后 UPDATE status，handoff `9ea0afb` 修过的关键顺序），只换验签方式和事件名：

```ts
export const runtime = 'nodejs'   // 必须读 raw body
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.text()
  // Creem 验签：一步完成验签+解析（替代 stripe 的 constructEventAsync）
  const event = await constructWebhookEventEntity(body, req.headers, {
    secret: process.env.CREEM_WEBHOOK_SECRET!,
  }).catch(() => null)
  if (!event) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })

  try {
    switch (event.eventType) {
      case 'checkout.completed':            // ⭐（Stripe 是 checkout.session.completed）
        await handleCheckoutCompleted(event.object)
        break
      // 其他事件（subscription.*、refund.created 等）忽略
      default:
        break
    }
  } catch (err) {
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 }) // 让 Creem 重试
  }
  return NextResponse.json({})
}
```

`handleCheckoutCompleted(obj)` 与现有 Stripe 版几乎逐行相同——从 `obj.metadata` 取 `payment_id / user_id / credits`、查 `payments.status` 防重复、`user_id` 防御比对、先 RPC 后 UPDATE。唯一新增：UPDATE 时把 `creem_order_id = obj.order?.id`（`ord_xxx`）一起写。

**关于失败/退款事件**：一次性支付失败时 Creem **不发** `checkout.completed`（用户在托管页直接看到失败），所以**不需要** Stripe 版的 `async_payment_failed` handler；退款走 `refund.created`，但 MVP 退款是手动在 dashboard 操作、不自动扣 credits，所以也**不监听**。只处理 `checkout.completed`。

---

## 6. 数据库

新建 `supabase/migrations/0002_creem.sql`，在 Supabase SQL Editor 手动执行（与现有流程一致）：

```sql
-- payments 表：Stripe 列 → Creem 列
alter table public.payments rename column stripe_session_id     to creem_checkout_id;
alter table public.payments rename column stripe_payment_intent to creem_order_id;
-- UNIQUE 约束由 Postgres 自动保留；idx_payments_user_id 不涉及这两列，不动
```

同步更新 `0001_init.sql` 源文件注释（「Stripe 支付记录」→「Creem 支付记录」、「Stripe webhook 调用」→「Creem webhook 调用」），供未来重建参考；DB 实际生效靠 0002。

`add_credits` / `deduct_credits` RPC **零改动**。

---

## 7. 数据流

### 7.1 购买流程

```
/pricing 选档 → POST /api/checkout {packageId}
  → INSERT payments(pending) → creem.checkouts.create
  → 返回 { url: checkout.checkoutUrl }
  → 前端 window.location.assign(url)
  → Creem 托管页付款
  → 跳回 /?success=true&checkout_id=...&order_id=...&customer_id=...&product_id=...
```

### 7.2 发放流程

```
Creem POST /api/creem-webhook（checkout.completed）
  → constructWebhookEventEntity 验签
  → 查 payments.status（已 paid 幂等返回）
  → user_id 防御比对
  → RPC add_credits（先）
  → UPDATE status='paid' + creem_order_id（后）
  → 前端 useCredits 挂载/返回时自动刷新余额
```

---

## 8. 错误处理矩阵

| 场景 | HTTP | 处理 |
|---|---|---|
| 未登录点购买 | 401 | 弹 SignIn modal |
| 无效 packageId | 400 | toast |
| `CREEM_PRODUCT_*` 环境变量缺失 | 500 | log「product not configured」 |
| Creem 创建会话失败 | 500 | payment 标 failed，toast「Checkout failed」 |
| webhook 验签失败 | 401 | log + 不处理 |
| webhook metadata 缺 payment_id | 200 | log（避免 Creem 重试） |
| webhook payment 不存在 | 200 | log |
| webhook status 已 paid | 200 | 幂等返回 |
| `add_credits` RPC 失败 | 500 | 让 Creem 重试（30s/1min/5min/1h 退避） |

---

## 9. 前端改动

- **`pricing-cards.tsx`**：`POST /api/checkout` 调用**不变**（仍 `{packageId}` → `{url}`），只改注释里的 "Stripe"、错误文案 `"Stripe returned no URL"` → `"Checkout returned no URL"`；跳转仍用 `window.location.assign`（不退化回 `href=`，避免 handoff 第 17 项的 react-hooks/immutability 报警）。
- **`pricing/page.tsx`**：底部文案 `🔒 Secured by Stripe · Test mode` → `🔒 Secured by Creem · Test mode`。
- **`payment-feedback.tsx`（方案 A）**：Creem 跳回 `/?success=true&checkout_id=...`，**没有** `credits=N`。
  - 简化为：监听 `?success=true` → 通用 toast `Payment successful! Your credits have been added.` → 不再 dispatch `credits:added`（amount 未知）。
  - 余额更新改由 `useCredits` 在返回站点时自动 `fetch /api/credits` 完成（机制已存在）。
  - `CreditsBadge`：保留 count-up + 高亮；移除依赖 `credits:added` amount 的精确「+N 浮动」文字（方案 A 的明确代价）。

---

## 10. 环境变量

`.env.example` / `.env.local` / Vercel：

```bash
# Stripe（删除）
# STRIPE_SECRET_KEY=...
# STRIPE_WEBHOOK_SECRET=...

# Creem（新增）
CREEM_API_KEY=creem_test_xxx           # test/live 各一套（dashboard > Developers）
CREEM_WEBHOOK_SECRET=whsec_xxx         # dashboard 注册 endpoint 时生成
CREEM_PRODUCT_STARTER=prod_xxx         # 3 档 one-time product，test/live 各一套
CREEM_PRODUCT_POPULAR=prod_xxx
CREEM_PRODUCT_PRO=prod_xxx
```

> `success_url` 沿用现有 `new URL(req.url).origin`，**不引入** `NEXT_PUBLIC_APP_URL`（最小改动）。
> 本地 `CREEM_WEBHOOK_SECRET` 不再像 Stripe 那样每次 `listen` 变——它是 dashboard 注册 endpoint 时固定生成的（开发体验改善）。

---

## 11. 本地测试方式（**变了**）

Stripe 的 `stripe listen --forward-to` 不再用。改为：

1. `ngrok http 3000` 拿公网 HTTPS
2. Creem dashboard → Developers → Webhooks → Add Endpoint：`https://<ngrok>.ngrok.io/api/creem-webhook`，复制生成的 `CREEM_WEBHOOK_SECRET` 填 `.env.local`
3. Test Mode 下 `/pricing` 选档 → Creem 托管页付款（**测试卡号以 Creem dashboard Test Mode 显示为准**——官方文档表格为空，实际看后台）
4. 验证 `payments` 表 + `users.credits`
5. dashboard 手动 resend 同一 `checkout.completed` 事件 → 验证 credits 不重复发放

> ⚠️ Creem 官方提示：WAF/Bot 防护（尤其 Cloudflare Bot Fight Mode）可能拦截 server-to-server webhook，需给 `/api/creem-webhook` 加 skip 规则。Day 7 部署 Vercel 时注意（Vercel 默认无此问题）。

---

## 12. 端到端验收清单

- [ ] 登录 → /pricing 选档 → 跳 Creem 托管页 → 测试卡付款 → 跳回 `/?success=true` → 通用 toast + 余额 +N
- [ ] DB `payments` 新增 `status='paid'`，`creem_checkout_id`（`ch_xxx`）/ `creem_order_id`（`ord_xxx`）有值；`users.credits` +N
- [ ] dashboard resend 同一事件 → credits 不重复（log「already paid, skipping」）
- [ ] 伪造 webhook（错误 secret）→ 401
- [ ] 未登录 → 401；无效 packageId → 400；product 未配置 → 500
- [ ] `npm run build` + `npm run lint` 干净
- [ ] credits 不足点 Generate 仍正常弹「Buy Credits」（use-generation 未动）

---

## 13. 回滚策略

- 用 **feature 分支**实施（建议 worktree 隔离），验证通过再合并 `main`。
- 回滚 = `git revert` 合并 commit。
- DB rename 因无真实数据，回滚后可手动执行反向 rename（或不管，反正没数据）。
- `.env.local` 旧 Stripe 值删除前先备份一行注释，便于应急。

---

## 14. 未做的事（YAGNI 清单）

- 订阅制（仍只一次性买断）
- 退款自动化（手动 dashboard）
- Stripe/Creem 并存或 feature flag 切换
- 多币种（只 USD）
- 邮件通知（Creem 默认发）
- 保存支付方式复用
- Apple Pay / Google Pay 特殊适配（Creem 托管页默认处理）
- webhook event_id 持久化去重（用 `payments.status` 检查已足够幂等）
- Customer Portal

---

## 15. 风险与备注

| 风险 | 影响 | 应对 |
|---|---|---|
| **Creem MoR 抽成侵蚀毛利** | 中 | 迁移前在 Creem 后台确认费率；原 75–85% 毛利可能下降，必要时调价（不在本迁移范围） |
| **product_id 配错档**（starter↔pro 颠倒） | 高 | `constants.ts` 的 `creemProductId` 与 dashboard product 严格对应；测试时验证每档金额 |
| **Test/Live 混用**（test key 配 live endpoint） | 高 | SDK `server` 参数 + 环境变量严格按环境填；上线前确认 `NODE_ENV=production` |
| **webhook 被 WAF 拦** | 中 | Vercel 默认无；自建域名+Cloudflare 时给 webhook 路由加 skip |
| **Creem 服务故障** | 低 | toast「Checkout unavailable」；Creem SLA 较高 |
| **success 页丢失精确 +N 动效** | 低 | 方案 A 已确认接受；徽章靠 useCredits refresh 仍会更新 |

---

## 16. 下一步

调用 `superpowers:writing-plans` skill 把本设计转成可逐步执行的实施计划（参考 Day 5/6 的 `docs/superpowers/plans/` 风格，每 task 含完整代码 + 验证命令 + commit 命令）。

**用户需在实施前完成**：
- [ ] Creem dashboard（Test Mode）创建 3 个 one-time product（USD：$4.99 / $14.99 / $29.99），拿到 3 个 `prod_xxx`
- [ ] 复制 `CREEM_API_KEY`（test）
- [ ] ngrok 隧道 + 注册 dev webhook endpoint，拿 `CREEM_WEBHOOK_SECRET`
- [ ] 三者填入 `.env.local`
