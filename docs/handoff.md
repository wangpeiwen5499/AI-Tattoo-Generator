# 项目交接文档

> 上次更新：**2026-08-08**
> 当前进度：**✅ 生产上线 — 支付/AI/认证/历史全链路打通**
> 分支：**`shipany-two`**（唯一活跃分支，原 `main` 旧 Demo 已废弃）
> 线上：**https://tattoovis.ink**（Vercel 部署）
> 项目路径：`D:\code\AI Tattoo Generator Template`

---

## 🔴 当前状态总览（2026-08-08）

### 已上线功能

| 功能 | 状态 |
|------|------|
| 首页落地页（Hero/How it works/Features/FAQ/CTA） | ✅ |
| 定价页（3 档 Tattoo Credits：$4.99/$14.99/$29.99） | ✅ |
| Generate 页面（上传照片 → 描述想法 → AI 生成 4 部位预览） | ✅ |
| 历史记录（/history 列表 + 详情大图） | ✅ |
| better-auth 邮箱注册/登录 | ✅ |
| 游客免费 1 次 + 注册送 3 次 | ✅ |
| Waffo 支付（one-time checkout → webhook → credits 到账） | ✅ 生产已跑通 |
| AI 纹身生成（KIE text-to-image + 4 部位 image-to-image） | ✅ |
| R2 图片存储（直传 + AI 输出落盘） | ✅ |
| 国际化（EN/ZH） | ✅ |
| 法律页面（Privacy/Terms/Acceptable Use） | ✅ |
| emailOTP 邮箱验证（需 Resend 配置后启用） | ✅ 已配好 |
| www → non-www 301 重定向 | ✅ |
| 黑暗模式 | ✅ |

### 近期修复记录（2026-08-07 ~ 08-08）

```
da39ae8  修复三个线上 bug：注册反馈 + 历史记录 + 邮箱验证
bbfcafa  修复：添加 Waffo 到 settings 注册表，使 env var 覆盖生效
6915146  修复支付 checkout：currency 小写 usd→大写 USD
f017d35  修复支付 checkout：amount 美元→美分转换
5ad6100  修复 AI 生成：after() 替换为 fire-and-forget 模式
6dc4a01  清理误提交的示例图片
efbe88a  修复 AI 生成流程：maxDuration 60→300s
4e995ae  修复 www 域名 CORS + 添加 www→non-www 重定向
0efc041  修复邮箱注册 CORS 错误：auth API route 添加 OPTIONS 处理
34bd522  添加法律页面：隐私策略 / 服务条款 / 可接受使用政策
c03fd80  重设计 Generate 页面：统一卡片 + 免费试用文案
da39ae8  修复三个线上 bug：注册反馈 + 历史记录 + 邮箱验证
```

---

## 1. 项目核心目标

**一句话定位**：用户上传身体照片 + 文字描述纹身想法 → AI 生成纹身图案并融合到 4 个身体部位（左臂 / 右臂 / 肩膀 / 小腿）→ Credits 制付费。

**定价**：Credits 制 5/20/50 次，$4.99 / $14.99 / $29.99。**游客免费 1 次 + 注册送 3 次**。

---

## 2. 技术栈

| 层 | 选型 | 版本/注意 |
|---|---|---|
| 框架 | **Next.js 16**（App Router + Turbopack）+ React 19 | `next.config.mjs`，React Compiler 已启用 |
| 样式 | **Tailwind CSS v4** | CSS-first 配置，`@theme inline` 在 `global.css`，**无 `tailwind.config.ts`** |
| 组件 | **Shadcn UI**（`@/shared/components/ui/`） | 基于 `@base-ui/react` |
| 认证 | **better-auth v1.3.7** | email/password + emailOTP 验证（Resend 发邮件） |
| 数据库 | **Supabase**（PostgreSQL，Session pooler） | Drizzle ORM，18+ 张表 |
| 存储 | **Cloudflare R2**（S3 兼容，预签名 URL 直传） | CORS 需配 `tattoovis.ink` |
| AI | **Kie.ai 中转 `gpt-image-2`** | 两步流程：text-to-image（1:1）→ image-to-image ×4（3:4） |
| 支付 | **Waffo**（`@waffo/pancake-ts`） | Merchant of Record，webhook 自动发放 credits |
| 邮件 | **Resend** | emailOTP 验证码 + 通知邮件 |

---

## 3. 环境变量

**Vercel 环境变量**（生产环境，21+ 个）：

| 变量 | 用途 |
|------|------|
| `NEXT_PUBLIC_APP_URL` | `https://tattoovis.ink` |
| `NEXT_PUBLIC_APP_NAME` | `AI Tattoo Generator` |
| `NEXT_PUBLIC_APPEARANCE` | `dark` |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `en` |
| `DATABASE_URL` | Supabase Session pooler URI |
| `DATABASE_PROVIDER` | `postgresql` |
| `AUTH_SECRET` | better-auth secret |
| `AUTH_URL` | `https://tattoovis.ink` |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 API Token |
| `R2_SECRET_ACCESS_KEY` | R2 API Token secret |
| `R2_BUCKET_NAME` | `ai-tattoo-generator` |
| `R2_PUBLIC_URL` | `https://pub-xxxxx.r2.dev` |
| `KIE_API_KEY` | Kie.ai API Key |
| `KIE_BASE_URL` | `https://api.kie.ai` |
| `WAFFO_MERCHANT_ID` | Waffo Live Merchant ID |
| `WAFFO_PRIVATE_KEY` | Waffo Live Private Key |
| `WAFFO_PRODUCT_STARTER` | Live product ID（5 credits） |
| `WAFFO_PRODUCT_POPULAR` | Live product ID（20 credits） |
| `WAFFO_PRODUCT_PRO` | Live product ID（50 credits） |
| `RESEND_API_KEY` | Resend API Key（邮箱验证） |
| `RESEND_SENDER_EMAIL` | `AI Tattoo Generator <noreply@tattoovis.ink>` |

---

## 4. 关键文件结构（当前）

```
src/
├── app/
│   ├── layout.tsx                              # Root layout（fonts + ads/analytics 注入）
│   ├── [locale]/
│   │   ├── layout.tsx                          # Locale layout（NextIntl + Theme + Toaster）
│   │   ├── (landing)/
│   │   │   ├── layout.tsx                      # Landing layout（Header + Footer）
│   │   │   ├── page.tsx                        # 首页（DynamicPage 渲染）
│   │   │   ├── pricing/page.tsx                # 定价页
│   │   │   ├── generate/page.tsx               # 生成页（TattooGenerator）
│   │   │   ├── history/page.tsx                # 历史记录列表
│   │   │   ├── history/[id]/page.tsx           # 历史详情大图
│   │   │   ├── privacy-policy/page.tsx         # 隐私策略
│   │   │   ├── terms-of-service/page.tsx       # 服务条款
│   │   │   ├── acceptable-use/page.tsx         # 可接受使用政策
│   │   │   └── (ai)/                           # AI 生成器页面（未启用）
│   │   ├── (auth)/
│   │   │   ├── sign-in/page.tsx                # 登录页
│   │   │   └── sign-up/page.tsx                # 注册页
│   │   ├── (admin)/admin/                      # 管理后台
│   │   └── (landing)/settings/                 # 用户设置
│   └── api/
│       ├── auth/[...all]/route.ts              # better-auth handler（含 OPTIONS CORS）
│       ├── payment/
│       │   ├── checkout/route.ts               # POST 创建 Waffo checkout
│       │   ├── callback/route.ts               # GET 支付回调
│       │   └── notify/[provider]/route.ts      # POST Waffo webhook
│       ├── ai/
│       │   ├── generate-tattoo/route.ts        # POST 触发 AI 生成（fire-and-forget）
│       │   └── generate-tattoo/status/route.ts # GET 轮询生成进度
│       ├── credits/route.ts                    # GET 查询余额
│       └── upload-url/route.ts                 # POST R2 预签名上传 URL
├── core/
│   ├── auth/
│   │   ├── config.ts                           # better-auth 配置（含 emailOTP 插件）
│   │   ├── index.ts                            # getAuth() 实例
│   │   └── client.ts                           # 浏览器端 auth client
│   ├── db/index.ts                             # Drizzle DB 单例
│   └── theme/                                  # 主题系统
├── config/
│   ├── index.ts                                # envConfigs（env var → config 映射）
│   ├── db/schema.ts                            # 数据库 schema（order/credit/user/tattoo_*…）
│   └── locale/messages/{en,zh}/                # 国际化文案
│       ├── landing.json                        # 导航栏/页脚/公共文本
│       ├── pages/index.json                    # 首页 sections
│       ├── pages/pricing.json                  # 定价页（items 数组格式）
│       └── common.json                         # 公共翻译
├── shared/
│   ├── blocks/
│   │   ├── sign/sign-up.tsx                    # 注册表单（含 toast.success）
│   │   ├── sign/sign-in.tsx                    # 登录表单（含 toast.success）
│   │   ├── tattoo/
│   │   │   ├── tattoo-generator.tsx            # 生成主组件（section+container 包裹）
│   │   │   ├── image-uploader.tsx              # 图片上传（拖拽/点击/进度圈/预览）
│   │   │   ├── generation-progress.tsx         # 生成进度展示
│   │   │   ├── generation-results.tsx          # 结果网格展示
│   │   │   └── credits-badge.tsx               # 余额徽章
│   │   └── email/verification-code.tsx         # 验证码邮件模板
│   ├── services/
│   │   ├── payment.ts                          # PaymentManager（Stripe/Creem/PayPal/Waffo）
│   │   ├── email.ts                            # EmailManager（Resend）
│   │   ├── settings.ts                         # 设置注册表（含 Waffo 配置项）
│   │   └── ...
│   ├── models/                                 # Drizzle 数据模型
│   │   ├── order.ts                            # 订单 CRUD
│   │   ├── credit.ts                           # 积分 CRUD
│   │   ├── user.ts                             # 用户查询
│   │   └── config.ts                           # getAllConfigs()（DB + env var 双层）
│   └── lib/seo.ts                              # getMetadata() 工厂函数
├── server/
│   ├── ai/
│   │   ├── types.ts                            # KIE API + 业务类型
│   │   ├── kie-client.ts                       # createTask/pollTask/pollManyTasks
│   │   ├── generate-tattoo.ts                  # Step 1: text-to-image
│   │   ├── apply-to-body.ts                    # Step 2: 4 部位 image-to-image
│   │   └── run-generation.ts                   # 后台生成入口（Step1+Step2+入库+退款）
│   ├── db/
│   │   ├── tattoo-queries.ts                   # 纹身业务查询（含 getProjectWithGenerations/listUserTattooProjects）
│   │   └── guest-queries.ts                    # 游客 IP 限流
│   └── auth/actor.ts                           # getActor()（登录用户/游客）
├── lib/
│   ├── constants.ts                            # BODY_PARTS/CREDIT_PACKAGES/上传限制
│   └── r2.ts                                   # R2 封装（getUploadUrl/fetchUrlAndUpload/getPublicUrl）
├── hooks/
│   ├── use-credits.ts                          # 余额查询 hook
│   └── use-generation.ts                       # 6 状态状态机 + 假进度 + 轮询
└── proxy.ts                                    # Next.js middleware（国际化 + auth 检查）
```

---

## 5. AI 生成流程

### 5.1 整体架构

```
POST /api/ai/generate-tattoo
  → getActor() 鉴权（登录用户/游客）
  → 游客：IP 限流检查（3次/天）
  → 登录用户：余额检查 + 扣积分
  → createTattooProject(status='processing')
  → void runGeneration({...})  ← fire-and-forget，在后台执行
  → 返回 { projectId }

前端轮询：GET /api/ai/generate-tattoo/status?id=<projectId>
```

### 5.2 runGeneration 执行流程

```
Step 1：generateTattooDesign
  → KIE createTask ('gpt-image-2-text-to-image', 1:1, prompt+模板)
  → pollTask (240s 超时, 2s 间隔)
  → fetchUrlAndUpload 下载到 R2
  → updateTattooProjectDesign

Step 2：applyTattooToBody
  → 4 部位并发 KIE createTask ('gpt-image-2-image-to-image', 3:4)
  → 并发 pollManyTasks (300s 超时)
  → 并发 downloadToR2
  → recordTattooGeneration ×4

判断：≥1 张成功 → status='completed'；全失败 → status='failed' + 退款
```

### 5.3 关键配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| Vercel maxDuration (api/ai/**) | **300s** | 必须 ≥ Step1 轮询时间 |
| Step 1 轮询超时 | 240s | text-to-image ~110s 实际 |
| Step 2 轮询超时 | 300s | image-to-image ×4 并发 ~80s |
| 前端轮询超时 | 5.5min | `use-generation.ts` POLL_TIMEOUT_MS |

---

## 6. 支付流程

### 6.1 架构

```
前端 /pricing → 点击套餐
  → POST /api/payment/checkout
    → createOrder (amount: 美分, currency: USD)
    → WaffoProvider.createPayment → Waffo checkout URL
    → updateOrder (status: created, checkoutUrl)
  → 返回 { checkoutUrl } → 前端跳转 Waffo

用户完成支付 → Waffo webhook
  → POST /api/payment/notify/waffo
    → verifyWebhook 验签
    → handleCheckoutSuccess (status: paid, grant credits)
```

### 6.2 关键注意

- **amount 存美分**：数据库 `order.amount` 是 `integer`（美分），checkout 代码用 `Math.round(checkoutAmount * 100)` 转换
- **currency 大写**：Waffo 要求 `USD`（不能 `usd`），传给 Waffo 前 `toUpperCase()`
- **Waffo webhook URL**：`https://tattoovis.ink/api/payment/notify/waffo`
- **Waffo 配置项必须在 settings 中注册**：`waffo_enabled/merchant_id/private_key` 已在 `settings.ts` getSettings() 中注册，env var 覆盖才会生效

---

## 7. 邮箱验证（emailOTP）

### 7.1 配置

Resend 已在 NameSilo DNS 验证 `tattoovis.ink`。

| Vercel env | 值 |
|------------|-----|
| `RESEND_API_KEY` | `re_xxxxxx...` |
| `RESEND_SENDER_EMAIL` | `AI Tattoo Generator <noreply@tattoovis.ink>` |

### 7.2 行为

- `emailOTP` 插件在 `auth/config.ts` 的 `getAuthPlugins()` 中条件启用
- 仅当 `resend_api_key` + `resend_sender_email` 都配置后才生效
- 注册时 better-auth 生成 OTP → Resend 发送验证邮件 → 用户输入验证码

### 7.3 NameSilo DNS 配置

Resend 域名验证 DNS TXT 记录在 **NameSilo**（不是 Vercel）添加，因为 `tattoovis.ink` 的 DNS 由 NameSilo 管理。

---

## 8. 已知问题 / 待办

| 问题 | 严重性 | 说明 |
|------|--------|------|
| PaymentFeedback toast 偶发不弹 | 低 | 支付成功后 credits 正常加，但 toast 有时不在前端显示 |
| 生成页无并发限制 | 中 | 同一用户可同时触发多次生成请求 |
| KIE 无 429 重试 | 低 | 生产环境目前未遇到限流 |
| 历史记录无分页 | 低 | 全量返回，重度用户多了需要加分页 |
| 移动端适配 | 低 | 基础可用，部分细节可优化 |

---

## 9. 常用操作

```bash
# 启动开发
npm run dev                    # http://localhost:3000

# 编译检查
npm run build

# Lint
npm run lint

# 数据库迁移
# drizzle-kit 不解析 .env.local，需要通过 node 脚本预加载：
node -e "require('dotenv').config({path:'.env.local',quiet:true});const{spawnSync}=require('child_process');spawnSync('npx',['drizzle-kit','generate','--config=src/core/db/config.ts'],{stdio:'inherit',env:process.env,shell:true})"
npm run db:migrate
```

---

## 10. 外部服务速查

| 服务 | Dashboard | 用途 |
|------|-----------|------|
| Vercel | vercel.com | 部署 + 环境变量 + 域名 |
| Supabase | supabase.com | PostgreSQL 数据库 |
| Cloudflare R2 | dash.cloudflare.com | 图片存储 |
| KIE.ai | kie.ai | AI 图片生成 |
| Waffo | dashboard.waffo.ai | 支付（Merchant of Record） |
| Resend | resend.com | 邮件发送（验证码） |
| NameSilo | namesilo.com | DNS 管理 |
| GitHub | github.com/wangpeiwen5499/AI-Tattoo-Generator | 代码仓库（shipany-two 分支） |

---

## 11. 给新会话的开场建议

1. 读这份文档（`docs/handoff.md`）
2. 跑 `npm run build` 确认编译干净
3. 跑 `npm run dev` 启动开发服务器
4. 关键代码位置：AI 生成 `src/server/ai/`，支付 `src/app/api/payment/`，认证 `src/core/auth/config.ts`
5. 所有 commit message 用中文，Co-Authored-By: Claude
