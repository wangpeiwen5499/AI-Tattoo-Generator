# 项目交接文档

> 上次更新：2026-07-19  
> 当前进度：**Day 1 + Day 2 + Day 3 已完成并推送，准备进入 Day 4**  
> 主分支：`main`，已推送到 `github.com:wangpeiwen5499/AI-Tattoo-Generator`（最新 `bafb944`）

---

## 1. 项目核心目标

**一句话定位**：用户上传身体照片 + 文字描述纹身想法 → AI 生成纹身图案并融合到 4 个身体部位（左臂 / 右臂 / 肩膀 / 小腿）→ Credits 制付费。

**商业假设（30 天内回答）**：世界上是否有人愿意为"AI 纹身预览"付费？

**MVP 严格边界**：3 个页面 + 1 个 AI 流程 + Stripe 支付。不做 AR / 视频 / 3D / 纹身师系统 / 博客 SEO。

**定价**：Credits 制 5/20/50 次，$4.99 / $14.99 / $29.99。注册送 1 次免费。

**完整计划文档**：[`docs/mvp-plan.md`](./mvp-plan.md)（744 行，含 schema、AI 代码、API 设计、7 天任务分解）

---

## 2. 进度总览

| Day | 任务 | 状态 |
|---|---|---|
| 1 | 项目搭建 + Clerk 认证 + 首页骨架 | ✅ 已完成（commit `7d5203e`）|
| 2 | Supabase schema + R2 存储 | ✅ 已完成（3 个 commit）|
| 3 | AI 生成核心流程（KIE 中转 + 两步流程） | ✅ 已完成（commit `bafb944`，已推送）|
| **4** | **前端生成页（上传 + 4 图结果网格）** | ⏳ **下一步开始** |
| 5 | Stripe 支付 | ⏳ |
| 6 | 历史记录 + UI 打磨 | ⏳ |
| 7 | 部署 Vercel + 端到端验证 | ⏳ |

---

## 3. Git 历史

```
bafb944  feat: 实现 AI 纹身生成核心流程（Day 3）            ← Day 3（已推送 origin/main）
462a0ec  feat: 用户首次调用 API 时自动创建用户记录          ← Day 2 第 3 commit
d751367  feat: 通过预签名 URL 实现 R2 直传上传              ← Day 2 第 2 commit
6f4d747  feat: 初始化 Supabase 数据库 schema                ← Day 2 第 1 commit
095fd20  chore: ignore local debug artifacts and settings   ← Day 1 清理
7d5203e  first commit                                       ← Day 1 全部代码
```

**协作规范**（见 `CLAUDE.md`）：
- 所有回答用中文
- 所有 commit message 用中文
- Co-Authored-By 行保留 `Claude Opus 4.6 <noreply@anthropic.com>`

---

## 4. 技术栈（实际安装版本，非计划文档写的版本）

| 层 | 选型 | 关键注意 |
|---|---|---|
| 框架 | **Next.js 16.2.10**（App Router + Turbopack）+ React 19.2.4 | 计划文档写的是 15，实际 `create-next-app@latest` 装的是 16 |
| 样式 | **Tailwind CSS v4**（CSS-first 配置） | 用 `@theme inline`，**无 `tailwind.config.ts`** |
| 组件 | **Shadcn UI**（基于 `@base-ui/react`，非 Radix） | 已加：button / card / dialog / input / label / textarea / sonner |
| 认证 | **Clerk Core 3** | ⚠️ API 大改：`<SignedIn>`/`<SignedOut>` 已删除，用 `<Show when="signed-in/out">`；`UserButton` 不再有 `afterSignOutUrl` 属性 |
| 数据库 | **Supabase**（PostgreSQL，仅用 service_role key） | **不用** Supabase Auth；所有访问走 API Route，靠 Clerk session + userId 校验鉴权 |
| 存储 | **Cloudflare R2**（S3 兼容，预签名 URL 直传） | 客户端直传不经 Next.js 服务器，省带宽；AI 输出图也落 R2（fetchUrlAndUpload） |
| AI | **Kie.ai 中转 OpenAI `gpt-image-2`**（弃用直连 OpenAI） | 两步流程：text-to-image 生成纹身 → image-to-image 融合到 4 部位。异步任务模型 + URL 输入输出，详见 `docs/kie-ai-api.md` |
| 支付 | **Stripe Checkout** | Webhook 发放 Credits，需防重复 |

### ⚠️ 关键技术陷阱（已踩过的坑）

1. **Clerk Core 3 破坏性变更**：
   - 旧 `<SignedIn>`/`<SignedOut>` 已删除 → 用 `<Show when="signed-in">` / `<Show when="signed-out">` 替代
   - `UserButton` 移除了 `afterSignOutUrl` → 用 `NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL` 环境变量替代
   - middleware 中 `createRouteMatcher` 也被标记为 deprecated，建议用 resource-based auth（每个路由内部检查），但 MVP 阶段保持现状

2. **Next.js 16 middleware 弃用警告**：
   - Next.js 16 把 `middleware.ts` 文件名约定改为 `proxy.ts`
   - 但 Clerk 还没提供 `clerkProxy` 函数，所以**保留 `src/middleware.ts`**，接受 deprecation warning
   - 等 Clerk 升级后再迁移

3. **Tailwind v4 CSS-first**：
   - 不要去找 `tailwind.config.ts`，配置在 `src/app/globals.css` 的 `@theme inline` 块里
   - 添加自定义颜色 / 字体直接改 globals.css

4. **Supabase JS client 在 Node 20 触发 Realtime 初始化失败**：
   - 任何 `createClient()` 调用都会尝试启动 Realtime（即使不用）
   - Node 20 没有原生 WebSocket，会抛 `Node.js 20 detected without native WebSocket support`
   - **解决方案**：`getSupabaseAdmin()` 设置 `auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }`（已做）
   - 但 verification 脚本仍然报错，所以用 PostgREST 直接 fetch 绕开（见 `scripts/verify-day2.mjs`）

5. **Supabase client 顶层导出会破坏 build**：
   - 错误写法：`export const supabaseAdmin = getSupabaseAdmin()`（模块加载时立即执行，build 时 env 未注入会抛错）
   - 正确写法：每个使用方在函数内部 `const supabaseAdmin = getSupabaseAdmin()`（lazy，build-friendly）
   - 已在 `src/lib/supabase/server.ts` 注释说明

6. **Cloudflare Turnstile 拦截 Playwright 自动化注册**：
   - 用 Playwright 自动注册 Clerk 测试账号会被反爬拒
   - 不影响真实用户登录，只是没法在 CI 用 Playwright 跑 e2e 注册测试
   - 想自动化测试需要用 Clerk 的测试 API 或预创建测试用户

7. **KIE.AI 接口与 OpenAI 原生 API 完全不同**（Day 3 已踩）：
   - **不能用 `openai` npm 包**，全部走 fetch
   - **统一入口** `POST /api/v1/jobs/createTask`，靠 body 里 `model` 字段区分（不是路径区分）
   - **body 嵌套**：业务字段都在 `input` 对象里，顶层只有 `model` / `callBackUrl` / `input`
   - **camelCase**：`callBackUrl`（不是 callback_url），`taskId`（不是 task_id），`recordInfo`（不是 record-info）
   - **响应 code 字段语义不规则**：示例里 `code:505` 但 `msg:"success"`，**只看 `data.state`** 判断成功失败
   - **resultJson 是字符串化的 JSON**：要二次 `JSON.parse` 才能拿到 `resultUrls`
   - **异步任务**：createTask 只返回 taskId，要轮询 `GET /api/v1/jobs/recordInfo?taskId=xxx` 拿结果
   - **图片只保留 14 天**：拿到结果 URL 后必须立即下载到 R2
   - **国内访问无需代理**：这是用 KIE 的主要原因
   - 完整 API 文档：`docs/kie-ai-api.md`；真实接口示例：`docs/gpt image2 接口调用.md`

8. **KIE aspect_ratio 只有 6 个值**：`auto / 1:1 / 9:16 / 16:9 / 4:3 / 3:4`
   - 没有 `2:3`、`3:2`、`21:9` 等
   - 本项目选择：纹身图案 `1:1`（方图），身体融合 `3:4`（竖图）

9. **KIE 没有同步等待接口**：
   - 必须 client 主动轮询，或者配置 `callBackUrl` webhook
   - MVP 用轮询（2s 间隔、Step1 240s / Step2 300s 超时），简单可控
   - 用 webhook 需要公网可访问 URL，开发环境跑不通

10. **KIE 任务实际耗时远超文档宣传**（Day 3 已踩）：
    - 文档说"3 秒生成"，实测 **text-to-image ~110 秒、image-to-image ~80 秒**
    - 一次 /api/generate 总耗时 **3-9 分钟**
    - 业务层默认超时设置：`generate-tattoo.ts` 240 秒、`apply-to-body.ts` 300 秒
    - **不能再用 60 秒超时**（首版踩过，导致任务超时但 KIE 已扣 credits）

11. **KIE 每次任务消耗 6 credits**（成本测算关键，已确认定价）：
    - KIE 平台定价（见 `docs/kie-pricing.jpg`）：
      - 1K 分辨率：6 credits ≈ **$0.03 / 张**
      - 2K 分辨率：10 credits ≈ $0.05 / 张
      - 4K 分辨率：16 credits ≈ $0.08 / 张
    - 本项目默认用 1K：
      - Step 1（text-to-image × 1）：6 credits
      - Step 2（image-to-image × 4 部位）：6 × 4 = 24 credits
      - **一次 /api/generate 总消耗：30 KIE credits ≈ $0.15**
    - 业务侧定价毛利率（1 次生成 = 1 tattoo credit）：
      - Starter $4.99 / 5 次 → 单次 $1.00 → 毛利 **85%**
      - Popular $14.99 / 20 次 → 单次 $0.75 → 毛利 **80%**
      - Pro $29.99 / 50 次 → 单次 $0.60 → 毛利 **75%**
    - **结论**：毛利率健康，定价档位无需调整

12. **R2 bucket 必须配 CORS 才能浏览器直传**（Day 3 已踩）：
    - Day 2 的 `verify:db` 走 Node.js 服务端，不受 CORS 限制 → 当时没暴露
    - Day 3 浏览器调 `/api/upload-url` 拿预签名 URL 后 PUT 到 R2 → 触发 CORS 拦截
    - **解决**：R2 bucket → Settings → CORS Policy，加上：
      ```json
      [{
        "AllowedOrigins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
        "AllowedHeaders": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3600
      }]
      ```
    - **`AllowedHeaders: ["*"]` 必须**，因为 AWS SDK v3 会自动加 `x-amz-checksum-crc32` 等 header
    - Day 7 部署 Vercel 后需要把生产域名也加进 AllowedOrigins

13. **`ensureUser` 的 PGRST116 bug**（Day 3 已踩，已修）：
    - 原代码：`.upsert({...}, { onConflict: 'id', ignoreDuplicates: true }).select().single()`
    - 当用户**已存在**时，`ignoreDuplicates: true` 会让 upsert 返回 0 行，`.single()` 抛 `PGRST116`
    - 第一次调用（新用户）正常，**第二次调用必报 500**
    - **修复**：去掉 `ignoreDuplicates: true`，让 upsert 在已存在时也返回该行（`src/server/db/ensure-user.ts`）
    - Day 2 当时没暴露是因为 `verify-day2.mjs` 用 PostgREST 直接测，不走 supabase-js 的 `.single()` 语义

---

## 5. 环境变量状态

`.env.local`（不提交到 git）当前已配齐 13/13 个：

| 状态 | 变量 | 用途 |
|---|---|---|
| ✅ | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk 公钥（pk_test_） |
| ✅ | `CLERK_SECRET_KEY` | Clerk 私钥（sk_test_） |
| ✅ | `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| ✅ | `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| ✅ | `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` 等 | `/` |
| ✅ | `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| ✅ | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon（MVP 实际不用） |
| ✅ | `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin（绕过 RLS） |
| ✅ | `R2_ACCOUNT_ID` | Cloudflare 账户 ID |
| ✅ | `R2_ACCESS_KEY_ID` | R2 API Token access key |
| ✅ | `R2_SECRET_ACCESS_KEY` | R2 API Token secret |
| ✅ | `R2_BUCKET_NAME` | `ai-tattoo-generator` |
| ✅ | `R2_PUBLIC_URL` | `https://pub-xxxxx.r2.dev`（r2.dev 公开域名已开启） |
| ✅ | `KIE_API_KEY` | Kie.ai API Key（Day 3 已配） |
| ✅ | `KIE_BASE_URL` | `https://api.kie.ai`（Day 3 已配） |
| ⏳ | `STRIPE_SECRET_KEY` | Day 5 起需要 |
| ⏳ | `STRIPE_WEBHOOK_SECRET` | Day 5 起需要 |

参考 `.env.example` 看完整字段。

---

## 6. 当前已实现的文件结构

```
src/
├── app/
│   ├── layout.tsx                          # ClerkProvider + Navbar 包裹
│   ├── page.tsx                            # 首页 Hero（"See Your Tattoo Before You Ink"）
│   ├── globals.css                         # Tailwind v4 @theme inline 配置
│   ├── sign-in/[[...sign-in]]/page.tsx     # Clerk 登录页
│   ├── sign-up/[[...sign-up]]/page.tsx     # Clerk 注册页
│   └── api/
│       ├── upload-url/route.ts             # POST 返回 R2 预签名上传 URL（Day 2）
│       └── generate/route.ts               # POST 串联 AI 生成完整流程（Day 3，核心）
├── components/
│   ├── navbar.tsx                          # 顶栏（Sign in / History / Buy Credits / UserButton）
│   └── ui/                                 # Shadcn 原子组件（7 个）
├── lib/
│   ├── utils.ts                            # cn()
│   ├── constants.ts                        # BODY_PARTS / CREDIT_PACKAGES / 上传限制
│   ├── r2.ts                               # R2 封装：getUploadUrl / getPublicUrl / makeObjectKey / makeOutputKey / fetchUrlAndUpload
│   └── supabase/
│       ├── server.ts                       # getSupabaseAdmin()（service_role，lazy）
│       └── client.ts                       # 浏览器占位（MVP 禁用）
├── server/
│   ├── ai/                                 # ⭐ Day 3 AI 模块
│   │   ├── types.ts                        # KIE + 业务类型
│   │   ├── kie-client.ts                   # createTask / getRecordInfo / pollTask / pollManyTasks
│   │   ├── generate-tattoo.ts              # Step 1：prompt → 纹身图案（text-to-image, 1:1）
│   │   └── apply-to-body.ts                # Step 2：4 部位并发融合（image-to-image, 3:4）
│   └── db/
│       ├── ensure-user.ts                  # Clerk id → upsert Supabase user（送 1 credit）
│       └── queries.ts                      # getCredits / createProject / deductCredits / refundCredits / recordGenerations / updateProjectStatus
├── types/
│   └── index.ts                            # DB 行 TS 类型
└── middleware.ts                           # Clerk 路由保护（仅 /history）

supabase/migrations/0001_init.sql           # 4 表 + 2 RPC + 触发器（已在 Supabase 执行）
scripts/
├── verify-day2.mjs                         # 端到端冒烟测试（DB + R2）
└── verify-day3.mjs                         # KIE 接口冒烟测试（消耗 ~2 credits）
docs/
├── mvp-plan.md                             # 完整计划（开发宪法）
├── handoff.md                              # 本文档
├── kie-ai-api.md                           # KIE API 使用文档（Day 3 参考）
├── kie-pricing.jpg                         # KIE 平台 gpt-image-2 定价截图
└── gpt image2 接口调用.md                  # 用户提供的真实接口示例（createTask + recordInfo）
```

---

## 7. 验证命令

```bash
# 启动开发服务器
npm run dev                                  # http://localhost:3000

# 编译检查
npm run build                                # 有 1 个已知 middleware 弃用警告，正常
npm run lint

# 端到端数据库 + R2 冒烟测试（独立脚本，不依赖 dev server）
npm run verify:db
# 预期：Supabase 5/5 ✅ + R2 3/3 ✅

# KIE 接口冒烟测试（消耗 ~2 credits，跑前确认余额）
npm run verify:day3
# 预期：text-to-image ✅ + R2 落图 ✅ + image-to-image ✅

# 手动测试 /api/upload-url（需要 Clerk 登录态）
# 浏览器 DevTools Console:
fetch('/api/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentType: 'image/jpeg' })
}).then(r => r.json()).then(console.log)

# 手动测试 /api/generate（需要 Clerk 登录态 + 已上传照片 + credits ≥ 1）
# 浏览器 DevTools Console（替换 bodyPhotoKey/Url 为 /api/upload-url 返回值）:
fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    bodyPhotoKey: 'uploads/userId/xxx.jpg',
    bodyPhotoUrl: 'https://pub-xxx.r2.dev/uploads/userId/xxx.jpg',
    prompt: 'dragon japanese style'
  })
}).then(r => r.json()).then(console.log)
```

---

## 8. Day 3 完成回顾 + Day 4 准备清单

### 8.1 Day 3 已完成事项

**Commit**：`bafb944 feat: 实现 AI 纹身生成核心流程（Day 3）`，已推送到 `origin/main`（15 个文件 +1680/-102）

✅ **AI 模块**（4 个新文件）：
- `src/server/ai/types.ts` — KIE + 业务类型
- `src/server/ai/kie-client.ts` — createTask / pollTask / pollManyTasks
- `src/server/ai/generate-tattoo.ts` — Step 1（text-to-image, aspect_ratio=1:1）
- `src/server/ai/apply-to-body.ts` — Step 2（4 部位并发 image-to-image, aspect_ratio=3:4）

✅ **API Route**：`src/app/api/generate/route.ts`
- Clerk 鉴权 + ensureUser + getCredits + deductCredits + createProject
- Step 1 + Step 2 串联
- recordGenerations + updateProjectStatus
- 失败兜底：refundCredits + updateProjectStatus('failed')

✅ **底层模块扩展**：
- `src/lib/r2.ts` 加 `makeOutputKey` + `fetchUrlAndUpload`
- `src/server/db/queries.ts` 加 createProject / deductCredits / refundCredits / recordGenerations / updateProjectStatus

✅ **测试脚本**：`scripts/verify-day3.mjs`（消耗 ~2 credits）

✅ **文档**：`docs/kie-ai-api.md`（KIE API 完整使用说明）

### 8.2 Day 3 实际流程（API Route 12 步，与原计划略有调整）

```
1. 验证 Clerk session（401）
2. ensureUser
3. 解析 body：bodyPhotoKey / bodyPhotoUrl / prompt
4. getCredits → 余额检查（402）
5. RPC deduct_credits（原子扣减；并发竞争时 RPC 抛错 → 402）
6. INSERT projects status='processing'
7. Step 1：generateTattooDesign → KIE text-to-image → 轮询 → 下载到 R2
8. Step 2：applyTattooToBody → 4 部位并发 KIE image-to-image → 并发轮询 → 并发下载到 R2
9. recordGenerations（4 条）
10. 判断：0 张成功 → 退款；≥1 张成功 → 标 completed
11. updateProjectStatus
12. 返回 projectId + tattooDesignUrl + images[]
```

**与原计划差异**：
- 没做并发检查（30 秒内只能 1 次）→ MVP 阶段先不做，Day 6 一起加
- 退款策略细化：4 张全失败才退款；≥1 张成功就不退

### 8.3 Day 4 要做的事（前端生成页）

| 文件 | 作用 |
|---|---|
| `src/app/generate/page.tsx` | 生成页主组件（上传 + prompt 输入 + 提交按钮） |
| `src/components/upload-box.tsx`（或类似） | 拖拽 / 点击上传组件，调 /api/upload-url |
| `src/components/result-grid.tsx` | 4 图结果网格展示（左臂/右臂/肩膀/小腿） |
| `src/components/credits-badge.tsx` | 显示当前 credits 余额 |

Day 4 详细任务见 `docs/mvp-plan.md` 的 Day 4 章节。

### 8.4 Day 4 开始前用户需要确认

- [x] **跑通 `npm run verify:day3`**：✅ KIE 接口 + R2 落图链路已验证通过
- [x] **手动调 `/api/generate`**：✅ 用真实 Clerk 登录态端到端跑通（纹身设计 + 4 部位融合全部成功）
- [x] **commit Day 3 代码**：✅ 已提交 `bafb944` 并推送到 `origin/main`
- [x] **KIE 成本测算**：✅ 单次成本 $0.15，毛利率 75-85%（详见 §4 第 11 项）
- [ ] 准备 5 张测试身体照片（Day 4 联调用，可临时用 verify-day3 测试图）

---

## 9. 关键代码位置（开发时高频参考）

| 主题 | 文件 | 行号/位置 |
|---|---|---|
| 完整 SQL schema | `supabase/migrations/0001_init.sql` | 全文件 |
| Credits 扣减 RPC | 同上 | `deduct_credits` 函数 |
| Credits 增加 RPC（Stripe webhook 用） | 同上 | `add_credits` 函数 |
| KIE API 完整文档 | `docs/kie-ai-api.md` | 全文件 |
| KIE 真实接口示例 | `docs/gpt image2 接口调用.md` | 全文件 |
| KIE createTask / 轮询 | `src/server/ai/kie-client.ts` | `createTask` / `pollTask` |
| Step 1 生成纹身（含 prompt 模板） | `src/server/ai/generate-tattoo.ts` | `buildPrompt` |
| Step 2 4 部位融合（含 prompt 模板） | `src/server/ai/apply-to-body.ts` | `buildPrompt` |
| API Route 完整流程 | `src/app/api/generate/route.ts` | `POST()` |
| 退款逻辑（失败兜底） | 同上 | `safeRefund()` |
| 上传限制（content-type/size） | `src/lib/constants.ts` | `ALLOWED_UPLOAD_CONTENT_TYPES` / `MAX_UPLOAD_BYTES` |
| 部位列表 | `src/lib/constants.ts` | `BODY_PARTS` |
| 定价档位 | `src/lib/constants.ts` | `CREDIT_PACKAGES` |
| R2 预签名 URL（客户端上传） | `src/lib/r2.ts` | `getUploadUrl()` |
| R2 URL→存储（AI 输出落盘） | `src/lib/r2.ts` | `fetchUrlAndUpload()` |
| Clerk 用户首入库 | `src/server/db/ensure-user.ts` | `ensureUser()` |
| Credits 扣减 / 退还 | `src/server/db/queries.ts` | `deductCredits` / `refundCredits` |

---

## 10. 已知问题 / 待办

| 问题 | 严重性 | 处理建议 |
|---|---|---|
| Next.js 16 middleware 弃用警告 | 低 | 等 Clerk 推出 `clerkProxy` 再迁移到 `src/proxy.ts` |
| Clerk `createRouteMatcher` 弃用警告 | 低 | MVP 保持现状，未来改为每路由内部 `auth()` 检查 |
| `scripts/verify-day2.mjs` 绕过 supabase-js（因 Node 20 Realtime bug） | 低 | 升级 Node 22 后可改用 supabase-js |
| AWS SDK 警告 "node >=22 required"（2027 年 1 月后） | 低 | 升级 Node 22 即可消除 |
| Playwright 自动化注册被 Turnstile 拦 | 低 | 不影响真实用户；如需 e2e 测试用 Clerk 测试用户 API |
| 没做生成请求的并发限制（同一用户 30 秒内可重复刷） | 中 | Day 6 加：在 deductCredits 前查 `projects` 表最近 30 秒记录 |
| KIE 没做 429 重试 | 低 | 首版直接抛错；如生产环境频繁 429 再加指数退避 |
| KIE recordInfo 接口未在文档页公布精确字段（猜的字段名） | 低 | 已跑通 `verify-day3.mjs` 验证；若生产跑挂了再用 DevTools 抓真实响应 |
| `.env.local` 没在 git（正常） | 无 | 团队成员需各自配置（参考 `.env.example`） |

---

## 11. 常用操作速查

```bash
# 启动开发
npm run dev

# 修改 schema 后重新跑数据库测试
npm run verify:db

# 跑 Day 3 KIE 接口冒烟测试（消耗 ~2 credits）
npm run verify:day3

# 添加新的 Shadcn 组件
npx shadcn add <component-name>

# 调用本地 Stripe webhook（Day 5）
stripe listen --forward-to localhost:3000/api/stripe-webhook

# 重启 dev server 让 .env.local 生效
npx kill-port 3000 && npm run dev
```

---

## 12. 给新会话的开场建议

如果你是新接手的 Claude 实例，第一次对话应该：

1. 读这份文档（`docs/handoff.md`）
2. 读 `CLAUDE.md`（协作规范：中文回答 + 中文 commit）
3. 读 `docs/mvp-plan.md` 的 Day N 章节（N = 当前要做的天）
4. 跑 `npm run verify:db` 确认数据库和 R2 还能正常工作
5. 跑 `npm run verify:day3` 确认 KIE 链路通（仅在 Day 3 之后需要）
6. 跑 `npm run build` 确认编译干净
7. 问用户：「准备好开始 Day N 了吗？需要你提前准备 X / Y / Z」

**永远不要**：
- 在没读 `docs/mvp-plan.md` 的情况下臆测范围
- 把 supabase-js 顶部 `export const supabaseAdmin = getSupabaseAdmin()` 加回来
- 用英文写 commit message
- 把 service_role key、R2 Secret 或 KIE_API_KEY 暴露到客户端代码
- 用 `openai` npm 包调 KIE（接口不兼容，要用 fetch）
- 直接信任 KIE 响应的 `code` 字段（看 `data.state`，code 语义不规则）
- 把 KIE 返回的图片 URL 直接给用户用（只保留 14 天，必须 fetchUrlAndUpload 落到 R2）
