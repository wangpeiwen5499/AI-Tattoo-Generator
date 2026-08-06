# 迁移计划：Demo → ShipAny Two 企业级 SaaS

## Context

当前 tattoovis.ink 是一个功能验证级 Demo（Next.js + Clerk + Waffo + Supabase + KIE AI），缺少管理后台、RBAC、FIFO 积分、国际化等企业级能力。用户决定以 ShipAny Two 模板为底座重建，保留 Waffo 支付和 KIE 纹身生成核心业务逻辑。

**目标**：将 Demo 中的纹身 AI 生成 + Waffo 支付 + R2 存储迁入 ShipAny Two，获得完整的企业级 SaaS 能力。

---

## Phase 1：底座搭建（Day 1）

### 1.1 初始化
- 以 ShipAny Two 为项目根目录
- 配置 `.env.local`：`DATABASE_URL`（Supabase PostgreSQL 直连）、`AUTH_SECRET`、`NEXT_PUBLIC_APP_URL` 等
- `npm install` + `npm run dev` 跑通

### 1.2 数据库
- 保留 ShipAny Two 的 18 张表（user/session/account/verification + config/taxonomy/post/order/subscription/credit/apikey/role/permission/role_permission/user_role/ai_task/chat/chat_message）
- 新增 tattoo 业务表：`tattoo_project`（生成项目）、`tattoo_generation`（单张生成结果）
- 迁移脚本放 `supabase/migrations/`，通过 Drizzle 或直接 SQL 执行

### 1.3 better-auth 替换 Clerk
- 保留 better-auth（ShipAny Two 默认），放弃 Clerk
- 配置邮箱密码登录 + Google OAuth（与当前 Clerk 体验一致）
- 新用户注册自动赠 3 credits（通过 `grantCreditsForNewUser` 配置）
- **注意**：当前 Clerk 用户数据需要手动迁移或让用户重新注册（Demo 阶段用户量小，建议重新注册）

### 1.4 国际化配置
- 中英文双语（en/zh），`next-intl` 已内置
- 翻译文件后续逐步补充

---

## Phase 2：Waffo 支付 Provider（Day 1-2）

### 2.1 创建 WaffoProvider
- 文件：`src/extensions/payment/waffo.ts`
- 实现 `PaymentProvider` 接口（参考 `creem.ts` 的模式，两者 API 类似）：
  - `name: 'waffo'`
  - `createPayment()` → 调用 `waffo.checkout.createSession()`
  - `getPaymentSession()` → 通过 sessionId 查询
  - `getPaymentEvent()` → webhook 验签 + 事件映射（`order.completed` → `CHECKOUT_SUCCESS`）
- 配置接口 `WaffoConfigs`：`merchantId`、`privateKey`

### 2.2 注册 Waffo 到 PaymentManager
- 修改 `src/shared/services/payment.ts`：
  - import `WaffoProvider`
  - 添加 `waffo_enabled` 分支，从数据库 config 读取 `waffo_merchant_id` / `waffo_private_key`
  - 设为 `defaultProvider`（当 `default_payment_provider === 'waffo'`）

### 2.3 配置定价数据
- 修改 `content/pages/en/pricing.json` 和 `zh/pricing.json`：
  - 3 档 Tattoo Credits：Starter（$4.99/5次）、Popular（$14.99/20次）、Pro（$29.99/50次）
  - `payment_providers: ["waffo"]`、`payment_product_id` 填 Waffo 产品 ID
  - `credits`、`valid_days`（永不过期 = 0）

### 2.4 Waffo Webhook
- ShipAny Two 已有 `/api/payment/notify/[provider]/route.ts`，Waffo 事件自动路由
- 只需在 Waffo Dashboard 配置 webhook URL：`https://tattoovis.ink/api/payment/notify/waffo`

### 2.5 依赖
- 安装 `@waffo/pancake-ts`，从当前项目复制 `src/lib/waffo.ts` 单例逻辑

---

## Phase 3：纹身 AI 核心（Day 2-3）

### 3.1 KIE Client 迁入
- ShipAny Two 的 `src/extensions/ai/` 已有 `kie.ts`，检查是否可用
- 如果不可用，从当前项目迁移：
  - `src/server/ai/kie-client.ts` → 适配 ShipAny Two 的 AI 扩展接口
  - `src/server/ai/types.ts` → 保留 KIE 类型定义
  - `src/server/ai/generate-tattoo.ts` → Step 1 text-to-image（保留 prompt 模板）
  - `src/server/ai/apply-to-body.ts` → Step 2 image-to-image 4 部位融合

### 3.2 接入 AI Task 系统
- ShipAny Two 的 `ai_task` 表用于记录任务+扣积分
- 创建 tattoo 专用 AI 路由：`/api/ai/generate-tattoo`（串联 Step1 + Step2 + 积分扣减）
- 异步模式：`after()` + 前端轮询（沿用当前项目的异步方案，避开 Vercel 网关超时）

### 3.3 R2 存储
- ShipAny Two 的 `src/extensions/storage/` 已有 `r2.ts`
- 从当前项目迁移 `src/lib/r2.ts` 逻辑（预签名 URL 上传 + fetchUrlAndUpload）

---

## Phase 4：纹身 UI 组件（Day 3-4）

### 4.1 迁入并适配组件
从当前项目迁移以下组件到 ShipAny Two，按 Two 的模式改造：

| 当前文件 | 迁移位置 | 改造点 |
|---------|---------|--------|
| `src/components/tattoo-generator.tsx` | `src/shared/blocks/generator/tattoo-generator.tsx` | 用 Two 的 i18n、用 Two 的 credits hook |
| `src/components/image-uploader.tsx` | `src/shared/blocks/common/tattoo-image-uploader.tsx` | 复用 Two 已有 image-uploader |
| `src/components/generation-progress.tsx` | `src/shared/blocks/generator/tattoo-progress.tsx` | 样式对齐 Two 主题 |
| `src/components/generation-results.tsx` | `src/shared/blocks/generator/tattoo-results.tsx` | 用 Two 的 Dialog 组件 |
| `src/components/credits-badge.tsx` | 不再需要 | Two 的 dashboard layout 自带 credits 显示 |

### 4.2 生成页面
- 在 `src/app/[locale]/(landing)/` 下创建 tattoo generator 页面
- 或放在 dashboard 内作为 `(dashboard)/generator/` 页面

### 4.3 首页落地页
- 用 Two 的主题 blocks 替换当前简陋的 Hero
- 保留 Showcase Carousel、How it works、FAQ、定价区
- 用 Two 的 `pages/landing.json` 翻译文件配置内容

---

## Phase 5：积分与业务逻辑（Day 4）

### 5.1 游客免费 1 次
- 沿用当前项目的 guest cookie 方案（`guest_id` cookie + IP 限流）
- 在 middleware 或 API route 层实现，不改 Two 核心

### 5.2 生成消耗积分
- 每次 /api/ai/generate-tattoo → 扣 1 credit（通过 Two 的 FIFO `consumeCredits`）
- 失败退款（通过 Two 的 `grantCredits` 回退）
- 复用 Two 的 `credit` 表流水记录

---

## Phase 6：部署（Day 5）

### 6.1 部署目标
- Vercel（与当前一致）
- Supabase PostgreSQL（通过 DATABASE_URL 直连）

### 6.2 环境变量
- 所有 ShipAny Two 需要的 env + Waffo + KIE + R2
- Vercel Dashboard 逐项填入

### 6.3 域名与 DNS
- `www.tattoovis.ink` 保持指向 Vercel
- **不需要** Clerk 自定义域名（better-auth 无此需求）
- 可删除或保留 `clerk.tattoovis.ink` CNAME（不再需要）

### 6.4 Waffo 生产环境
- Waffo Dashboard 切 Live mode
- 更新 `WAFFO_MERCHANT_ID` / `WAFFO_PRIVATE_KEY` 为 live 值
- 注册生产 webhook：`https://tattoovis.ink/api/payment/notify/waffo`

---

## 验证清单

### Phase 1 验证
- [ ] `npm run dev` 启动成功，首页可访问
- [ ] better-auth 注册/登录正常
- [ ] 管理后台 `/admin` 可访问

### Phase 2 验证
- [ ] `/pricing` 页面显示 3 档 Tattoo Credits
- [ ] 点击购买 → 跳转 Waffo Checkout → 测试卡支付成功 → 回跳 → credits 到账
- [ ] Waffo webhook 验签 + 积分发放正常

### Phase 3 验证
- [ ] 上传身体照片 + prompt → KIE 生成纹身图案 → 4 部位融合 → 结果展示
- [ ] 失败场景退款正常
- [ ] R2 图片上传/下载正常

### Phase 4 验证
- [ ] 首页落地页完整渲染（Hero/Showcase/How it works/FAQ/Pricing）
- [ ] 移动端适配
- [ ] 中英文切换正常

### Phase 5 验证
- [ ] 游客访问 → 生成 1 次免费 → 再次生成提示注册
- [ ] 注册送 3 credits
- [ ] 消耗/退款流水在 credit 表可查

### Phase 6 验证
- [ ] `npm run build` 通过
- [ ] Vercel 部署成功
- [ ] 生产域名端到端：注册 → 生成 → 购买 → 历史记录

---

## 风险与注意事项

1. **Supabase 直连**：ShipAny Two 用 `postgres.js` 驱动连接 PostgreSQL。Supabase 的 PG 连接串在 `Settings → Database → Connection string → URI`，Session mode 即可
2. **现有用户数据**：Clerk → better-auth 无法自动迁移用户密码，Demo 用户量小建议让用户重新注册；如需保留，可手动在 better-auth user 表 INSERT 现有邮箱
3. **Waffo 不支持 cancel URL**：这在当前项目已踩过坑，ShipAny Two 的 checkout route 会传 `cancelUrl`，Waffo Provider 实现时忽略即可
4. **异步生成超时**：Vercel Hobby 60s / Pro 300s 限制，保持当前项目的 `after()` + 轮询方案
5. **主题定制**：ShipAny Two 的主题系统支持自定义，纹身行业需要视觉调整（颜色/字体），后续可在 `themes/` 下创建 tattoo 主题
