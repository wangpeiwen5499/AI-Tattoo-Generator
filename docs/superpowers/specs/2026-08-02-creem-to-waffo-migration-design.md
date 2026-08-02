# Creem → Waffo Pancake 支付迁移设计

> **日期**：2026-08-02
> **状态**：设计已与用户确认，待写实施计划
> **原因**：Creem 审核过不了，换 Waffo Pancake（同为 MoR 商户）。

---

## 1. 目标

把支付从 Creem 整体迁移到 Waffo Pancake（`@waffo/pancake-ts`），保持前端契约不变（`/api/checkout` 仍返回 `{url}`，PaymentFeedback 仍监听 `?success=true`）。

---

## 2. 现状（Creem）

| 文件 | 作用 |
|---|---|
| `src/lib/creem.ts` | `getCreem()` 单例（apiKey + server test/prod） |
| `src/app/api/checkout/route.ts` | `creem.checkouts.create({productId, successUrl, customer:{email}, requestId, metadata})` → INSERT payments(creem_checkout_id 占位)→ UPDATE → 返回 `{url}` |
| `src/app/api/creem-webhook/route.ts` | raw body → `constructWebhookEventEntity(body, headers, {secret})` 验签（需 `CREEM_WEBHOOK_SECRET`）→ `checkout.completed` → metadata 关联 payments → `add_credits` → UPDATE paid |
| `payments` 表 | `creem_checkout_id`(NOT NULL UNIQUE) + `creem_order_id`（0002 从 stripe rename 来） |
| env | `CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET` / `CREEM_PRODUCT_STARTER|POPULAR|PRO` |
| `CREDIT_PACKAGES` | `creemProductId` 字段存 env 变量名 |

---

## 3. Waffo Pancake SDK 概要（调研确认）

- 客户端：`new WaffoPancake({ merchantId, privateKey })`（env: `WAFFO_MERCHANT_ID` + `WAFFO_PRIVATE_KEY`）
- 一次性产品：`client.onetimeProducts.create({storeId, name, prices:{USD:{amount:"29.00", taxIncluded, taxCategory}}})`
- checkout：`client.checkout.createSession({productId, productType:"onetime", currency, successUrl, buyerEmail, metadata})` → `{checkoutUrl, sessionId, expiresAt}`
- webhook：`verifyWebhook(rawBody, sigHeader)`（**SDK 内嵌 test/prod 公钥，不需 secret env**）；事件 `order.completed`（`WebhookEventType.OrderCompleted`）
- 金额：display amount 字符串（`"29.00"`，不是 cents）
- 防重复：webhook `event.id`（delivery ID）+ 业务层 `payments.status`
- 包：`@waffo/pancake-ts@0.16.1`，MIT，零运行时依赖，Waffo 官方（`@waffo.com` 维护者）

---

## 4. 已确认决策

| 决策点 | 选择 |
|---|---|
| 3 档产品创建 | **Dashboard 手动建**（用户操作），product ID 填 `WAFFO_PRODUCT_*` env |
| webhook URL 注册 | **Dashboard 配**（用户操作）：`https://tattoovis.ink/api/waffo-webhook`，test mode，事件 `order.completed` |
| PEM key 格式 | **escaped newlines**（`WAFFO_PRIVATE_KEY="-----BEGIN...\n...\n-----END..."`），SDK auto-normalize |
| payments 列 | **rename** creem→waffo（0004 migration，同 0002 stripe→creem 套路） |
| metadata 关联 | **假设 `event.data.metadata.{payment_id,user_id,credits}` 透传**（见 §8 风险） |
| 前端 | **零改动**（PricingCards / PaymentFeedback 不动） |

---

## 5. 改动

### 5.1 `src/lib/waffo.ts`（新建，替换 lib/creem.ts）
```ts
import { WaffoPancake } from '@waffo/pancake-ts'

function createWaffoClient(): WaffoPancake {
  const merchantId = process.env.WAFFO_MERCHANT_ID
  const privateKey = process.env.WAFFO_PRIVATE_KEY
  if (!merchantId || !privateKey) {
    throw new Error('WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY not set in .env.local')
  }
  return new WaffoPancake({ merchantId, privateKey })
}

let _waffo: WaffoPancake | null = null
export function getWaffo(): WaffoPancake {
  if (!_waffo) _waffo = createWaffoClient()
  return _waffo
}
```

### 5.2 `src/app/api/checkout/route.ts`（改 Waffo）
保持 `auth()`（**游客不能买**，只有登录用户能 checkout）。流程：
1. auth + ensureUser（不变）
2. 校验 packageId（不变）
3. `productId = process.env[pkg.waffoProductId]`（env 名改）
4. INSERT payments（`waffo_session_id` 占位，status=pending）
5. `const session = await getWaffo().checkout.createSession({ productId, productType: 'onetime', currency: 'USD', successUrl: \`${origin}/?success=true\`, buyerEmail: email, metadata: { payment_id, user_id, credits, package_id } })`
6. UPDATE payments.`waffo_session_id` = `session.sessionId`
7. 返回 `{ url: session.checkoutUrl }`

### 5.3 `src/app/api/waffo-webhook/route.ts`（新建，替换 creem-webhook）
```ts
import { verifyWebhook, WebhookEventType } from '@waffo/pancake-ts'
export const runtime = 'nodejs'        // 验签需 raw body
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const body = await req.text()        // 必须 raw text，不能 .json()
  const sig = req.headers.get('x-waffo-signature')
  if (!sig) return new Response('Missing signature', { status: 401 })
  let event
  try {
    event = verifyWebhook(body, sig)   // 内嵌公钥，不需 secret
  } catch {
    return new Response('Invalid signature', { status: 401 })
  }
  if (event.eventType === WebhookEventType.OrderCompleted) {
    await handleOrderCompleted(event)  // 发 credits（见下）
  }
  return new Response('OK')
}
```
`handleOrderCompleted`：从 `event.data.metadata` 取 `payment_id/user_id/credits`（假设透传，见 §8）→ 查 payments.status（已 paid 跳过）→ 校验 user_id 一致 → `add_credits` RPC → UPDATE status=paid + `waffo_order_id` = `event.data.orderId`。顺序：**先 RPC 后 UPDATE**（同 Creem，RPC 失败 → 重试 → status 仍 pending）。

### 5.4 `supabase/migrations/0004_waffo.sql`（新建，用户在 Supabase 跑）
```sql
alter table public.payments rename column creem_checkout_id to waffo_session_id;
alter table public.payments rename column creem_order_id     to waffo_order_id;
```
UNIQUE 约束自动保留；idx_payments_user_id 不涉及这两列。

### 5.5 清理 Creem
- 删 `src/lib/creem.ts`
- 删 `src/app/api/creem-webhook/route.ts`（整个目录）
- `npm uninstall creem`
- `src/lib/constants.ts`：`CREDIT_PACKAGES` 的 `creemProductId` 字段 → `waffoProductId`（值 `'CREEM_PRODUCT_STARTER'` → `'WAFFO_PRODUCT_STARTER'` 等）
- `src/types/index.ts`：`CreditPackage.creemProductId` → `waffoProductId`

### 5.6 env（`.env.local` + `.env.example`）
新增：
- `WAFFO_MERCHANT_ID=MER_16spMbT8fzeS4i6HBHSN6J`
- `WAFFO_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----`（escaped newlines）
- `WAFFO_PRODUCT_STARTER` / `WAFFO_PRODUCT_POPULAR` / `WAFFO_PRODUCT_PRO`（Dashboard 建后填）

删除：`CREEM_API_KEY` / `CREEM_WEBHOOK_SECRET` / `CREEM_PRODUCT_*`

### 5.7 前端
**零改动**。PricingCards "Get started" → `/api/checkout`（契约 `{url}` 不变）；PaymentFeedback 监听 `?success=true`（不变）；cancel URL 仍在 Waffo Dashboard 配全局 → `/pricing?canceled=true`。

---

## 6. 用户操作清单（Dashboard / Supabase）

1. **Waffo Dashboard 建产品**：3 个一次性产品（Starter $4.99 / Popular $14.99 / Pro $29.99，taxCategory=`digital_goods`），拿 3 个 `PROD_xxx` 填 `.env.local` 的 `WAFFO_PRODUCT_*`
2. **Waffo Dashboard 配 webhook**：URL=`https://tattoovis.ink/api/waffo-webhook`，test mode，事件 `order.completed`
3. **Waffo Dashboard 配全局 cancel URL**：→ `/pricing?canceled=true`（Waffo 不支持 per-checkout cancel）
4. **Supabase 跑 0004 migration**：`0004_waffo.sql`（rename payments 列）
5. **填 `.env.local`**：`WAFFO_MERCHANT_ID` / `WAFFO_PRIVATE_KEY` / `WAFFO_PRODUCT_*`（删 `CREEM_*`）
6. **Vercel 环境变量**：同步上面 WAFFO_* + 删 CREEM_*

---

## 7. 验证清单

- [ ] `npm run lint && npm run build` 全过
- [ ] 0004 migration 在 Supabase 执行
- [ ] 本地 ngrok + Waffo dashboard 配 dev webhook，跑通：点 Starter → Waffo checkout → 测试卡 `4576 7500 0000 0110` → 跳回 /?success=true + toast + credits +N
- [ ] 数据库 payments 新增 status=paid（waffo_session_id/waffo_order_id 有值），users.credits +5
- [ ] 防重复：resend 同一 webhook，payments.status=paid 跳过，credits 不重复加
- [ ] 无 `creem` 残留：`git grep -i creem` 只剩 handoff 历史文档
- [ ] 生产 tattoivis.ink 端到端跑通

---

## 8. 风险：metadata 是否透传到 webhook

Waffo 文档说 checkout `metadata` "Passed through to webhook event.data"，但 webhook event shape 文档**只列了 `{orderId, buyerEmail, currency, amount, taxAmount, productName}`，没列 metadata**。

**当前设计假设 `event.data.metadata.{payment_id, user_id, credits}` 存在**（像 Creem 那样靠 metadata 关联 payments 行）。

**实测验证**（必须）：上线后第一次 webhook，`console.log(JSON.stringify(event.data))` 看有无 metadata。
- **有 metadata** → 设计成立，无需改。
- **无 metadata** → 改兜底：用 `event.data.buyerEmail` 找 user（需 buyerEmail = Clerk 用户 email，checkout 时传了）+ `event.data.productName` 映射 credits（Starter=5/Popular=20/Pro=50）+ 找该 user 最近一笔 pending payment 认领。不如 metadata 可靠（同用户买同档多次有歧义），但能跑通。

---

## 9. 非目标（YAGNI）

- 不做 Waffo 订阅（subscriptionProducts）—— 我们是 credits 一次性购买。
- 不做退款 UI（Waffo refund 事件暂不处理，手动 Dashboard 退）。
- 不做 webhook event.id 额外去重表（payments.status 防重复够，同 Creem）。
- 不动定价（$4.99/$14.99/$29.99 不变）。
- 不迁移历史 creem payments 数据（rename 列名，旧行 waffo_session_id 留空，仅历史记录）。
