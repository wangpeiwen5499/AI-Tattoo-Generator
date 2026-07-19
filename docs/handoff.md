# 项目交接文档

> 上次更新：2026-07-19  
> 当前进度：**Day 1 + Day 2 已完成，准备进入 Day 3**  
> 主分支：`main`，已推送到 `github.com:wangpeiwen5499/AI-Tattoo-Generator`

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
| **3** | **AI 生成核心流程（产品命脉，60% 效果门槛）** | ⏳ **下一步开始** |
| 4 | 前端生成页（上传 + 4 图结果网格） | ⏳ |
| 5 | Stripe 支付 | ⏳ |
| 6 | 历史记录 + UI 打磨 | ⏳ |
| 7 | 部署 Vercel + 端到端验证 | ⏳ |

---

## 3. Git 历史

```
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
| 存储 | **Cloudflare R2**（S3 兼容，预签名 URL 直传） | 客户端直传不经 Next.js 服务器，省带宽 |
| AI | **OpenAI `gpt-image-1`** | 两步流程：`images.generate` 生成纹身 → `images.edit` 融合到身体 |
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

---

## 5. 环境变量状态

`.env.local`（不提交到 git）当前已配齐 10/12 个：

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
| ⏳ | `OPENAI_API_KEY` | Day 3 起需要 |
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
│       └── upload-url/route.ts             # POST 返回 R2 预签名上传 URL（Day 2）
├── components/
│   ├── navbar.tsx                          # 顶栏（Sign in / History / Buy Credits / UserButton）
│   └── ui/                                 # Shadcn 原子组件（7 个）
├── lib/
│   ├── utils.ts                            # cn()
│   ├── constants.ts                        # BODY_PARTS / CREDIT_PACKAGES / 上传限制
│   ├── r2.ts                               # R2 S3 封装（getUploadUrl / getPublicUrl / makeObjectKey）
│   └── supabase/
│       ├── server.ts                       # getSupabaseAdmin()（service_role，lazy）
│       └── client.ts                       # 浏览器占位（MVP 禁用）
├── server/
│   └── db/
│       ├── ensure-user.ts                  # Clerk id → upsert Supabase user（送 1 credit）
│       └── queries.ts                      # getCredits / getProjectForUser
├── types/
│   └── index.ts                            # DB 行 TS 类型
└── middleware.ts                           # Clerk 路由保护（仅 /history）

supabase/migrations/0001_init.sql           # 4 表 + 2 RPC + 触发器（已在 Supabase 执行）
scripts/verify-day2.mjs                     # 端到端冒烟测试（DB + R2）
docs/
├── mvp-plan.md                             # 744 行完整计划（开发宪法）
└── handoff.md                              # 本文档
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

# 手动测试 /api/upload-url（需要 Clerk 登录态）
# 浏览器 DevTools Console:
fetch('/api/upload-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ contentType: 'image/jpeg' })
}).then(r => r.json()).then(console.log)
```

---

## 8. Day 3 准备清单（开始前必须完成）

### 8.1 用户需要准备

- [ ] **OpenAI API key**：去 https://platform.openai.com/api-keys 创建
  - ⚠️ `gpt-image-1` 可能需要单独申请权限（不一定每个账号都有）
  - 填到 `.env.local` 的 `OPENAI_API_KEY`
- [ ] **5 张测试照片**：真实人物，手臂 / 肩膀 / 小腿可见，清晰，无遮挡
- [ ] **5 个测试 prompt**（计划文档建议）：
  - `dragon japanese style`
  - `minimalist flower`
  - `tribal arm band`
  - `quote in script font`
  - `geometric sacred geometry`

### 8.2 Day 3 要写的文件（按计划）

| 文件 | 作用 |
|---|---|
| `src/server/ai/types.ts` | AI 流程类型定义 |
| `src/server/ai/generate-tattoo.ts` | Step 1：text → 纹身图案（`images.generate`） |
| `src/server/ai/apply-to-body.ts` | Step 2：纹身 + 身体照片 → 融合图（`images.edit`）⚠️ 产品命脉 |
| `src/app/api/generate/route.ts` | 串联完整流程的 API |
| `src/lib/constants.ts` | 部位列表已在，可能补 prompt 模板 |

### 8.3 Day 3 完整流程（API Route 内）

```
1. 验证 Clerk session（401 if not signed in）
2. ensureUser（首次创建 user 记录）
3. 并发检查（同一用户 30 秒内不能重复生成，429）
4. getCredits → 余额检查（< 1 返回 402）
5. RPC deduct_credits（原子扣减）
6. INSERT projects（status='processing'）
7. Step 1：调 OpenAI 生成纹身图案（1 次）
8. Step 2：并发调 4 次 images.edit（left_arm / right_arm / shoulder / calf）
   用 Promise.allSettled，单张失败不影响其他
9. 把纹身图案 + 4 张融合图 PUT 到 R2（也可直接用 OpenAI 返回 URL，但建议落 R2）
10. INSERT generations（4 条）
11. UPDATE projects SET status='completed', completed_at=now()
12. 返回 project_id + 4 张图 URL
```

### 8.4 Day 3 效果门槛（必须达到才继续 Day 4）

- 纹身图案（Step 1）清晰、线条明确、白底无杂物
- 身体融合图（Step 2）4 个部位中**至少 3 个部位定位正确**（不能跑到脸上 / 衣服上）
- 融合图**不像贴纸**：有透视、有光影、有皮肤纹理感
- 用 5 张测试照片 × 5 个 prompt = **25 组中至少 15 组达标**（60% 通过率）

**未达门槛的应对**：
- 部位定位差 → 加 mask（在身体照片对应部位画白色区域）
- 贴纸感强 → 提高 quality 到 `high`（成本升到 $0.167/张，但仍可行）
- 整体效果差 → 切换到 **Replicate Flux Kontext**（备选方案）
- 切换后仍未达标 → **暂停 MVP，回到用户讨论**

---

## 9. 关键代码位置（开发时高频参考）

| 主题 | 文件 | 行号/位置 |
|---|---|---|
| 完整 SQL schema | `supabase/migrations/0001_init.sql` | 全文件 |
| Credits 扣减 RPC | 同上 | `deduct_credits` 函数 |
| Credits 增加 RPC（Stripe webhook 用） | 同上 | `add_credits` 函数 |
| AI 两步流程示例代码 | `docs/mvp-plan.md` | L229 起 |
| Day 3 任务清单 | `docs/mvp-plan.md` | L557 起 |
| 上传限制（content-type/size） | `src/lib/constants.ts` | `ALLOWED_UPLOAD_CONTENT_TYPES` / `MAX_UPLOAD_BYTES` |
| 部位列表 | `src/lib/constants.ts` | `BODY_PARTS` |
| 定价档位 | `src/lib/constants.ts` | `CREDIT_PACKAGES` |
| R2 预签名 URL | `src/lib/r2.ts` | `getUploadUrl()` |
| Clerk 用户首入库 | `src/server/db/ensure-user.ts` | `ensureUser()` |

---

## 10. 已知问题 / 待办

| 问题 | 严重性 | 处理建议 |
|---|---|---|
| Next.js 16 middleware 弃用警告 | 低 | 等 Clerk 推出 `clerkProxy` 再迁移到 `src/proxy.ts` |
| Clerk `createRouteMatcher` 弃用警告 | 低 | MVP 保持现状，未来改为每路由内部 `auth()` 检查 |
| `scripts/verify-day2.mjs` 绕过 supabase-js（因 Node 20 Realtime bug） | 低 | 升级 Node 22 后可改用 supabase-js |
| AWS SDK 警告 "node >=22 required"（2027 年 1 月后） | 低 | 升级 Node 22 即可消除 |
| Playwright 自动化注册被 Turnstile 拦 | 低 | 不影响真实用户；如需 e2e 测试用 Clerk 测试用户 API |
| `.env.local` 没在 git（正常） | 无 | 团队成员需各自配置（参考 `.env.example`） |

---

## 11. 常用操作速查

```bash
# 启动开发
npm run dev

# 修改 schema 后重新跑数据库测试
npm run verify:db

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
5. 跑 `npm run build` 确认编译干净
6. 问用户：「准备好开始 Day N 了吗？需要你提前准备 X / Y / Z」

**永远不要**：
- 在没读 `docs/mvp-plan.md` 的情况下臆测范围
- 把 supabase-js 顶部 `export const supabaseAdmin = getSupabaseAdmin()` 加回来
- 用英文写 commit message
- 跳过 Day 3 的 60% 效果门槛（这是产品命脉）
- 把 service_role key 或 R2 Secret 暴露到客户端代码
