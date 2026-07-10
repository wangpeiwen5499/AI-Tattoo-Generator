# AI 纹身生成器 SaaS MVP 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Context（为什么做这件事）

用户有一个 AI 纹身预览 SaaS 的 idea（参考文档 `参考内容/idea-文身.md`），目标是 7 天内上线 MVP，验证核心商业假设：**是否有人愿意为"AI 纹身预览"付费**。

参考文档反复强调一个原则：独立开发者最危险的不是技术实现，而是花 2-3 个月做出完整产品后才发现没人买单。因此 MVP 严格控制在 **3 个页面 + 1 个 AI 流程 + Stripe 支付**。

用户已选择"直接做 MVP 开发计划"（跳过技术 POC）。但 AI 图像融合质量是产品命脉、也是最大不确定性，因此在 Day 3 设置**效果门槛**：达不到门槛必须先停下来调优或换模型，不能盲目往后做。

预期成果：30 天内回答"世界上是否有人愿意为 AI 纹身预览付费"。如果有人付费，再扩展到 Tattoo Planner、纹身师 SaaS、AR 试纹身等方向。

---

## Goal

上线一个可付费的 AI 纹身预览 Web 应用：用户上传身体照片 + 文字描述纹身想法 → AI 生成纹身图案并融合到 4 个身体部位（左臂/右臂/肩膀/小腿）→ Credits 制付费（5/20/50 次，$4.99/$14.99/$29.99）。

## Architecture

- **全栈 Next.js 15 App Router**（前后端同仓库，部署简单、SEO 友好）
- **AI 两步流程**：Step1 `images.generate` 生成纹身图案（text→image）→ Step2 `images.edit` 把纹身融合到身体照片（image+image→image）。两步拆开比一步到位效果更可控
- **4 部位并发**：Step1 只调一次（共用纹身图案），Step2 用 `Promise.allSettled` 并发调 4 次（左臂/右臂/肩膀/小腿），单张失败不影响其他
- **用户照片直传 R2**（预签名 URL，不经过 Next.js 服务器，省带宽）
- **Credits 原子扣减**（Supabase RPC 函数 + 数据库行锁，防并发刷接口）
- **Stripe Webhook 发放 Credits**（支付完成才到账，避免前端伪造）

## Tech Stack

- Next.js 15（App Router）+ React 19 + TypeScript
- TailwindCSS + Shadcn UI（组件库）
- Clerk（Google + 邮箱登录）
- Supabase（PostgreSQL，仅作数据库，不用 Supabase Auth）
- Cloudflare R2（对象存储，S3 兼容）
- OpenAI `gpt-image-1`（纹身图案生成 + 身体融合）
- Stripe Checkout（Credits 一次性付费）

## MVP 范围（严格遵守）

**做**：首页生成器 / Credits 购买页 / 历史记录页 / Clerk 登录 / Stripe 支付

**不做**：AR、视频、3D、纹身师系统、AI Tattoo Planner、博客 SEO、纹身方案书 PDF、纹身师沟通包

---

## 项目目录结构

```
D:\code\AI Tattoo Generator\
├── .env.local                          # 本地环境变量（gitignore）
├── .env.example                        # 环境变量模板（提交到 git）
├── .gitignore
├── next.config.ts                      # 图片域名白名单
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                     # Shadcn UI 配置
├── middleware.ts                       # Clerk 认证中间件
├── supabase/
│   └── migrations/
│       └── 0001_init.sql               # 表结构 + RPC + RLS
└── src/
    ├── app/
    │   ├── layout.tsx                  # 根布局：ClerkProvider + Toaster
    │   ├── page.tsx                    # 首页/生成页（核心）
    │   ├── globals.css
    │   ├── sign-in/[[...sign-in]]/page.tsx
    │   ├── sign-up/[[...sign-up]]/page.tsx
    │   ├── pricing/page.tsx            # Credits 购买页
    │   ├── history/page.tsx            # 用户历史
    │   └── api/
    │       ├── generate/route.ts       # POST 核心：生成（消耗 credit）
    │       ├── upload-url/route.ts     # POST 获取 R2 预签名上传 URL
    │       ├── checkout/route.ts       # POST 创建 Stripe Session
    │       ├── stripe-webhook/route.ts # POST Stripe 回调（发放 credits）
    │       └── credits/route.ts        # GET 查询余额
    ├── components/
    │   ├── ui/                         # Shadcn 原子组件
    │   ├── tattoo-generator.tsx        # 生成器主组件
    │   ├── image-uploader.tsx          # 拖拽上传 + 预览
    │   ├── generation-results.tsx      # 4 张结果 2x2 网格
    │   ├── pricing-cards.tsx
    │   ├── credits-badge.tsx
    │   ├── history-list.tsx
    │   └── navbar.tsx
    ├── lib/
    │   ├── utils.ts                    # cn()
    │   ├── constants.ts                # 部位列表、定价、限制
    │   ├── supabase/client.ts          # 浏览器侧
    │   ├── supabase/server.ts          # 服务端 service_role client
    │   ├── r2.ts                       # R2 S3 SDK 封装
    │   └── stripe.ts                   # Stripe + packages 配置
    ├── server/
    │   ├── ai/
    │   │   ├── generate-tattoo.ts      # Step 1：text→纹身图案
    │   │   ├── apply-to-body.ts        # Step 2：纹身+身体→融合图
    │   │   └── types.ts
    │   └── db/
    │       ├── queries.ts              # credits/generations 查询封装
    │       └── ensure-user.ts          # Clerk JWT → upsert user
    ├── hooks/
    │   ├── use-generation.ts
    │   └── use-credits.ts
    └── types/
        └── index.ts
```

**关键文件（按优先级）**：
- `src/app/api/generate/route.ts` — 串联 credits 检查、AI 两步调用、R2 存储、DB 写入
- `src/server/ai/apply-to-body.ts` — AI 第二步，决定产品效果
- `src/app/api/stripe-webhook/route.ts` — 支付回调，credits 发放
- `src/lib/r2.ts` — 存储封装
- `supabase/migrations/0001_init.sql` — 数据库基础

---

## 数据库 Schema

完整 SQL（直接执行于 Supabase Dashboard）：

```sql
-- supabase/migrations/0001_init.sql
create extension if not exists "pgcrypto";

-- users：主键直接用 Clerk user ID
create table if not exists public.users (
    id          text primary key,
    email       text not null,
    credits     integer not null default 1,      -- 新用户送 1 次免费体验
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);

-- projects：一次生成请求
create table if not exists public.projects (
    id              uuid primary key default gen_random_uuid(),
    user_id         text not null references public.users(id) on delete cascade,
    body_photo_key  text not null,               -- R2 key（原始上传照片）
    body_photo_url  text not null,
    prompt          text not null,
    status          text not null default 'pending', -- pending/processing/completed/failed
    error_message   text,
    created_at      timestamptz not null default now(),
    completed_at    timestamptz
);
create index idx_projects_user_id on public.projects(user_id, created_at desc);

-- generations：一个 project 下 4 张结果
create table if not exists public.generations (
    id                  uuid primary key default gen_random_uuid(),
    project_id          uuid not null references public.projects(id) on delete cascade,
    user_id             text not null references public.users(id) on delete cascade,
    body_part           text not null,           -- left_arm/right_arm/shoulder/calf
    tattoo_image_key    text,                    -- Step 1 生成的纹身图案（4 张共用）
    result_image_key    text,
    result_image_url    text,
    status              text not null default 'pending',
    created_at          timestamptz not null default now()
);
create index idx_generations_project_id on public.generations(project_id);
create index idx_generations_user_id on public.generations(user_id, created_at desc);

-- payments：Stripe 支付
create table if not exists public.payments (
    id                  uuid primary key default gen_random_uuid(),
    user_id             text not null references public.users(id) on delete cascade,
    stripe_session_id   text unique not null,
    stripe_payment_intent text,
    amount              integer not null,        -- 分：499 = $4.99
    credits_purchased   integer not null,
    status              text not null default 'pending', -- pending/paid/failed
    created_at          timestamptz not null default now(),
    paid_at             timestamptz
);
create index idx_payments_user_id on public.payments(user_id, created_at desc);

-- updated_at 触发器
create or replace function public.handle_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
    for each row execute function public.handle_updated_at();

-- 原子扣减 credits（行级检查 + update，防并发）
create or replace function public.deduct_credits(
    p_user_id text, p_amount integer
) returns void as $$
begin
    update public.users set credits = credits - p_amount
    where id = p_user_id and credits >= p_amount;
    if not found then raise exception 'Insufficient credits'; end if;
end;
$$ language plpgsql;

-- 原子增加 credit（Stripe webhook 用）
create or replace function public.add_credits(
    p_user_id text, p_amount integer
) returns void as $$
begin
    update public.users set credits = credits + p_amount where id = p_user_id;
end;
$$ language plpgsql;
```

**关于 RLS 的说明**：MVP 阶段所有数据库访问都通过 Next.js API Route（已登录态）+ `service_role` key，`service_role` 会**绕过 RLS**。因此 RLS 在 MVP 中实际不起保护作用，真正的鉴权发生在 API 层（验证 Clerk session + 检查 userId 匹配）。建议仍开启 RLS 表策略（代码省略）作为纵深防御，但不要依赖它。

**用户首次登录自动建 user 记录**：不用 DB 触发器（Clerk 不走 Supabase Auth），而是在每个 API 入口调用 `ensureUser()`：

```typescript
// src/server/db/ensure-user.ts
import { supabaseAdmin } from '@/lib/supabase/server';
export async function ensureUser(clerkUserId: string, email: string) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert({ id: clerkUserId, email }, { onConflict: 'id', ignoreDuplicates: true })
    .select().single();
  if (error) throw error;
  return data;
}
```

---

## AI 生成流程（产品核心）

### 两步拆分的原因

一步把"文字描述 + 身体照片"扔给 AI，模型要同时处理纹身设计 + 身体融合两件事，效果差且不可控。拆成两步后，每步只专注一件事，纹身图案质量显著提升。

### Step 1：生成纹身图案

```typescript
// src/server/ai/generate-tattoo.ts
import OpenAI from 'openai';
const openai = new OpenAI(); // 自动读 OPENAI_API_KEY

export async function generateTattooDesign(prompt: string): Promise<Buffer> {
  const enhancedPrompt =
    `A professional tattoo design on a clean white background. ` +
    `Style: ${prompt}. High detail, bold lines, suitable for tattoo stencil. ` +
    `No text, no watermark, no human body parts.`;
  const result = await openai.images.generate({
    model: 'gpt-image-1',
    prompt: enhancedPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'low', // $0.011/张
  });
  return Buffer.from(result.data[0].b64_json!, 'base64');
}
```

### Step 2：融合到身体照片

```typescript
// src/server/ai/apply-to-body.ts
import OpenAI, { toFile } from 'openai';
const openai = new OpenAI();

const BODY_PART_PROMPTS: Record<string, string> = {
  left_arm:  "Place the tattoo design from the second image onto the person's left arm (viewer's right). Make it look like a real tattoo on skin, following the arm's curve and muscle. Natural lighting and skin texture.",
  right_arm: "Place the tattoo design from the second image onto the person's right arm (viewer's left). Make it look like a real tattoo on skin, following the arm's curve and muscle. Natural lighting and skin texture.",
  shoulder:  "Place the tattoo design from the second image onto the person's shoulder area. Follow the curve of the shoulder and deltoid. Natural lighting and skin texture.",
  calf:      "Place the tattoo design from the second image onto the person's calf/lower leg. Follow the curve of the calf muscle. Natural lighting and skin texture.",
};

export async function applyTattooToBody(
  bodyPhoto: Buffer,
  tattooDesign: Buffer,
  bodyPart: string
): Promise<Buffer> {
  const partPrompt = BODY_PART_PROMPTS[bodyPart];
  if (!partPrompt) throw new Error(`Unknown body part: ${bodyPart}`);

  const result = await openai.images.edit({
    model: 'gpt-image-1',
    // image[0] 是身体照片（编辑对象），image[1] 是纹身图案（参考）
    image: [
      await toFile(bodyPhoto, 'body.png', { type: 'image/png' }),
      await toFile(tattooDesign, 'tattoo.png', { type: 'image/png' }),
    ],
    prompt: partPrompt,
    n: 1,
    size: '1024x1024',
    quality: 'medium', // $0.042/张
  });
  return Buffer.from(result.data[0].b64_json!, 'base64');
}
```

**关于 mask**：`images.edit` 的 mask 参数可选。MVP 第一版**不传 mask**，靠 prompt 文字引导部位。如果 Day 3 验证发现部位定位不准，再加 mask（在对应部位画白色区域）作为 fallback。

**关于多图 edit**：`gpt-image-1` 的 `images.edit` 支持数组形式的多张参考图。如果实际调用报错（SDK 版本差异），降级方案是单图 edit（只传 body photo）+ prompt 中描述纹身图案，效果会差一些但仍可用。

### 4 部位并发编排

```typescript
// src/app/api/generate/route.ts 核心片段
const BODY_PARTS = ['left_arm', 'right_arm', 'shoulder', 'calf'] as const;

// Step 1：只调一次，4 个部位共用纹身图案
const tattooDesign = await generateTattooDesign(prompt);
const tattooKey = `tattoos/${projectId}/design.png`;
await uploadBuffer(tattooDesign, tattooKey);

// Step 2：4 个部位并发
const bodyPhotoBuffer = await fetchFromR2(bodyPhotoKey);
const results = await Promise.allSettled(
  BODY_PARTS.map(part => applyTattooToBody(bodyPhotoBuffer, tattooDesign, part))
);

for (let i = 0; i < BODY_PARTS.length; i++) {
  const r = results[i];
  const part = BODY_PARTS[i];
  if (r.status === 'fulfilled') {
    const key = `results/${projectId}/${part}.png`;
    await uploadBuffer(r.value, key);
    await supabaseAdmin.from('generations').insert({
      project_id: projectId, user_id: userId, body_part: part,
      tattoo_image_key: tattooKey, result_image_key: key,
      result_image_url: getR2PublicUrl(key), status: 'completed',
    });
  } else {
    await supabaseAdmin.from('generations').insert({
      project_id: projectId, user_id: userId, body_part: part,
      tattoo_image_key: tattooKey, status: 'failed',
    });
  }
}
```

### 成本与耗时

| 步骤 | 调用 | 单价 | 数量 | 小计 |
|---|---|---|---|---|
| Step 1 纹身图案 | `images.generate` low | $0.011 | 1 | $0.011 |
| Step 2 身体融合 | `images.edit` medium | $0.042 | 4 | $0.168 |
| **合计** | | | | **$0.179** |

按最低档 $4.99/5 次算：每次 $0.998，毛利 $0.819（82%）。耗时 8–13 秒/次。

### 错误处理

- Step 1 失败：整个请求失败，**回滚 credits**（重新加回 1）
- Step 2 部分失败：成功的正常返回，失败的标记 `failed`
- Step 2 全部失败：project 标 `failed`，**退还 credits**
- 单次 API 调用超时 30s，整体流程上限 90s

---

## API 路由设计

| 路由 | 方法 | 登录 | 消耗 credit | 说明 |
|---|---|---|---|---|
| `/api/upload-url` | POST | 是 | 否 | 返回 R2 预签名上传 URL（用户照片直传） |
| `/api/generate` | POST | 是 | 是（1） | 触发 AI 两步生成，返回 4 张结果 URL |
| `/api/checkout` | POST | 是 | 否 | 创建 Stripe Checkout Session |
| `/api/stripe-webhook` | POST | 否（Stripe 签名） | 否（加 credit） | 支付完成回调，发放 credits |
| `/api/credits` | GET | 是 | 否 | 查询当前余额 |

### `/api/generate` 关键流程

```
1. 验证 Clerk session → 取 userId + email
2. ensureUser(userId, email)
3. 检查并发：是否存在 status in ('pending','processing') 的 project → 有则 429
4. 检查 credits >= 1 → 不足 402（提示去 /pricing）
5. RPC deduct_credits(userId, 1) → 原子扣减（失败说明余额被并发刷走，409）
6. 创建 project（status='processing'）
7. 执行 AI 两步流程
8. 全失败 → 退还 credits、project='failed'
9. 否则 project='completed'、completed_at=now()
10. 返回 { projectId, tattooDesignUrl, results: [...] }
```

---

## Credits 规则与防滥用

- **新用户送 1 credit**（免费试一次）
- **每次生成（4 部位）消耗 1 credit**
- **Credits 永不过期**
- **并发控制**：检查 `projects.status in ('pending','processing')`，存在则 429
- **原子扣减**：`deduct_credits` RPC 在数据库层做 `credits >= amount` 检查，防并发刷
- **Stripe 到账才发放**：webhook 验证签名 + 检查 `payments.status != 'paid'`（防重复发放）后才 `add_credits`
- **不限制同一张照片复用**（用户可能想试不同纹身，是正常需求）

---

## 环境变量清单

```bash
# .env.example

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=ai-tattoo-generator
R2_PUBLIC_URL=https://tattoo-images.yourdomain.com

# OpenAI
OPENAI_API_KEY=sk-proj-xxx

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## 关键代码模块（可复用）

### `src/lib/r2.ts`

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const R2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = process.env.R2_PUBLIC_URL!;

export async function getUploadUrl(userId: string, fileType: string) {
  const ext = fileType === 'image/jpeg' ? 'jpg' : 'png';
  const key = `uploads/${userId}/${randomUUID()}.${ext}`;
  const command = new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: fileType });
  const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 600 });
  return { uploadUrl, key, publicUrl: `${PUBLIC_URL}/${key}` };
}

export async function uploadBuffer(buffer: Buffer, key: string, contentType = 'image/png') {
  await R2.send(new PutObjectCommand({
    Bucket: BUCKET, Key: key, Body: buffer, ContentType: contentType,
  }));
  return `${PUBLIC_URL}/${key}`;
}

export function getR2PublicUrl(key: string) {
  return `${PUBLIC_URL}/${key}`;
}
```

### `src/lib/stripe.ts`

```typescript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export const CREDIT_PACKAGES = {
  starter:  { name: 'Starter - 5 Credits',  price: 499,  credits: 5  },
  pro:      { name: 'Pro - 20 Credits',     price: 1499, credits: 20 },
  ultimate: { name: 'Ultimate - 50 Credits', price: 2999, credits: 50 },
} as const;

export type PackageKey = keyof typeof CREDIT_PACKAGES;
```

### `src/lib/constants.ts`

```typescript
export const BODY_PARTS = [
  { key: 'left_arm',  label: 'Left Arm'  },
  { key: 'right_arm', label: 'Right Arm' },
  { key: 'shoulder',  label: 'Shoulder'  },
  { key: 'calf',      label: 'Calf'      },
] as const;

export const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB
export const ACCEPTED_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const FREE_CREDITS = 1;
export const CREDITS_PER_GENERATION = 1;
```

---

## 7 天任务拆解

> **执行原则**：每个可独立验收的小块一个 commit。每天结束前必须能跑通当天的验收标准。

### Day 1：项目初始化 + 认证

**目标**：Next.js 项目跑起来，Clerk 登录可用。

**文件**：`package.json` / `src/app/layout.tsx` / `src/app/page.tsx`（占位）/ `src/app/globals.css` / `middleware.ts` / `src/app/sign-in/[[...sign-in]]/page.tsx` / `src/app/sign-up/[[...sign-up]]/page.tsx` / `src/components/navbar.tsx` / `.env.local` / `.env.example`

**关键步骤**：
- [ ] `npx create-next-app@latest` 初始化（TypeScript + Tailwind + App Router）
- [ ] `npx shadcn@latest init` 配置 Shadcn UI
- [ ] 安装 `@clerk/nextjs`，按官方文档包裹 `ClerkProvider`
- [ ] 配置 Clerk 中间件保护 `/history` 路由
- [ ] 在 Clerk Dashboard 创建 Application，配置 Google OAuth
- [ ] `navbar.tsx` 用 Clerk 的 `<UserButton />` 和 `<SignInButton />`

**验收**：
- [ ] `npm run dev` 无报错
- [ ] 首页显示导航栏
- [ ] 点击 Sign In 弹出 Clerk 组件，Google + 邮箱登录都能成功
- [ ] 登录后导航栏显示用户头像

**commits**：`init: scaffold Next.js 15 with TypeScript and Tailwind` / `feat: integrate Clerk authentication`

---

### Day 2：数据库 + R2 存储

**目标**：Supabase 表就绪，R2 能上传下载。

**文件**：`supabase/migrations/0001_init.sql` / `src/lib/supabase/client.ts` / `src/lib/supabase/server.ts` / `src/lib/r2.ts` / `src/server/db/ensure-user.ts` / `src/server/db/queries.ts` / `src/app/api/upload-url/route.ts` / `next.config.ts`

**关键步骤**：
- [ ] Supabase Dashboard 创建项目，SQL Editor 执行 `0001_init.sql`
- [ ] `src/lib/supabase/server.ts` 用 `service_role` key 创建 admin client
- [ ] 安装 `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- [ ] R2 创建 Bucket，启用 public access，创建 API Token
- [ ] `next.config.ts` 的 `images.remotePatterns` 配置 R2 域名
- [ ] `/api/upload-url` 实现：验证登录 → `ensureUser()` → `getUploadUrl()` → 返回

**验收**：
- [ ] SQL 执行无报错，表和 RPC 都创建成功
- [ ] curl `POST /api/upload-url` 返回有效预签名 URL
- [ ] 用 `curl -X PUT -T photo.png <uploadUrl>` 上传成功
- [ ] 浏览器访问 `<publicUrl>` 能看到图片
- [ ] 新用户调用 `/api/upload-url` 后，`users` 表自动出现记录，`credits=1`

**commits**：`feat: setup Supabase database schema` / `feat: implement R2 upload via presigned URLs` / `feat: add user auto-creation on first API call`

---

### Day 3：AI 生成核心流程（⚠️ 效果门槛）

**目标**：AI 两步流程跑通，输出 4 张预览。**这一天决定整个项目是否成立。**

**文件**：`src/server/ai/types.ts` / `src/server/ai/generate-tattoo.ts` / `src/server/ai/apply-to-body.ts` / `src/lib/constants.ts` / `src/app/api/generate/route.ts` / `src/types/index.ts`

**关键步骤**：
- [ ] `generate-tattoo.ts` 调用 `images.generate` 生成纹身图案
- [ ] `apply-to-body.ts` 调用 `images.edit` 多图融合
- [ ] `/api/generate` 完整流程：验证登录 → ensureUser → 并发检查 → credits 检查 → RPC 扣减 → 创建 project → Step 1 → Step 2 并发 → 存 R2 → 写 generations → 更新 project 状态 → 返回
- [ ] 准备测试集：5 张真实人物照片（手臂/肩膀/小腿可见）+ 5 个典型 prompt（dragon japanese / minimalist flower / tribal arm band / quote script / geometric）

**⚠️ 效果门槛（必须达到才继续 Day 4）**：
- [ ] 纹身图案（Step 1）清晰、线条明确、白底无杂物
- [ ] 身体融合图（Step 2）4 个部位中至少 3 个**部位定位正确**（不能跑到脸上/衣服上）
- [ ] 融合图**不像贴纸**：有透视、有光影、有皮肤纹理感
- [ ] 用 5 张测试照片 × 5 个 prompt = 25 组中，**至少 15 组**达到上述标准（60% 通过率）

**如果未达门槛**：
- 部位定位差 → 加 mask（在身体照片对应部位画白色区域）
- 贴纸感强 → 提高 quality 到 `high`（成本升到 $0.167/张，但仍可行）
- 整体效果差 → 切换到 Replicate 的 Flux Kontext（备选方案，需要换 SDK）
- 切换后仍未达标 → **暂停 MVP，回到用户讨论**

**验收**：
- [ ] curl `POST /api/generate` 传有效 `bodyPhotoKey` + `prompt`，10–15 秒内返回 4 张图 URL
- [ ] 浏览器打开 4 张 URL 看到融合图
- [ ] credits 余额正确扣减（1 → 0）
- [ ] credits 不足时返回 402
- [ ] 重复触发返回 429

**commits**：`feat: tattoo design generation (step 1)` / `feat: body placement fusion (step 2)` / `feat: generate API with credits deduction`

---

### Day 4：前端生成页

**目标**：完整的首页生成体验。

**文件**：`src/components/image-uploader.tsx` / `src/components/tattoo-generator.tsx` / `src/components/generation-results.tsx` / `src/hooks/use-generation.ts` / `src/hooks/use-credits.ts` / `src/components/credits-badge.tsx` / `src/app/page.tsx`

**关键步骤**：
- [ ] `image-uploader`：拖拽 + 点击上传，调 `/api/upload-url` 拿到预签名 URL 后 `fetch PUT` 直传 R2，显示缩略图
- [ ] `tattoo-generator`：上传 + prompt 输入框 + Generate 按钮 + loading skeleton
- [ ] `generation-results`：2x2 网格，每张可点击放大（用 Shadcn Dialog）
- [ ] `use-generation` hook 管理 idle/uploading/generating/completed/error 状态
- [ ] `use-credits` hook 在生成后自动刷新余额
- [ ] 生成失败/credits 不足时用 `sonner` 弹 toast

**验收**：
- [ ] 拖拽照片显示预览缩略图
- [ ] 输入 prompt 点击 Generate，10–15 秒后展示 4 张结果
- [ ] 每张图可点击放大
- [ ] credits 实时更新（生成后 -1）
- [ ] credits=0 时点击 Generate 弹"购买 credits"提示
- [ ] 移动端基本可用（不崩）

**commits**：`feat: image uploader with drag-drop` / `feat: tattoo generator main UI` / `feat: generation results grid`

---

### Day 5：Stripe 支付

**目标**：用户可以购买 credits。

**文件**：`src/lib/stripe.ts` / `src/app/api/checkout/route.ts` / `src/app/api/stripe-webhook/route.ts` / `src/app/pricing/page.tsx` / `src/components/pricing-cards.tsx` / `src/app/api/credits/route.ts`

**关键步骤**：
- [ ] Stripe Dashboard 创建 3 个 Product（或直接用 `CREDIT_PACKAGES` 常量传 price_data）
- [ ] `/api/checkout` 创建 Session，`metadata: { user_id, credits }`
- [ ] `/api/stripe-webhook` 验签 → `checkout.session.completed` → 更新 `payments.status='paid'` → RPC `add_credits`
- [ ] **关键防重复**：webhook 处理前先查 `payments` 表，如果已是 `paid` 直接返回 200（Stripe 会重试）
- [ ] 本地用 `stripe listen --forward-to localhost:3000/api/stripe-webhook` 测试
- [ ] `pricing-cards` 显示 3 档，点击调 `/api/checkout` 拿到 URL 后 `window.location = url`

**验收**：
- [ ] `/pricing` 显示 3 个定价卡片
- [ ] 点击购买跳转 Stripe Checkout
- [ ] 测试卡 `4242 4242 4242 4242` 支付成功
- [ ] `stripe listen` 收到 webhook，credits 正确增加
- [ ] 支付完成跳回网站，余额已更新
- [ ] 重复 webhook 不会重复发放 credits

**commits**：`feat: Stripe checkout session` / `feat: Stripe webhook with credits fulfillment` / `feat: pricing page`

---

### Day 6：历史记录 + UI 打磨

**目标**：用户可查看历史，UI 达上线标准。

**文件**：`src/app/history/page.tsx` / `src/components/history-list.tsx` / `src/app/page.tsx`（hero + FAQ 占位）/ `src/components/navbar.tsx`（加 History 链接）/ `tailwind.config.ts`

**关键步骤**：
- [ ] `/history` 查 `projects where user_id = ? order by created_at desc`，每条 join 4 张 generations
- [ ] `history-list` 卡片：prompt + 纹身图案 + 4 张缩略图 + 时间
- [ ] 点击卡片展开大图（Shadcn Dialog）
- [ ] 空状态："You haven't generated any tattoos yet" + CTA 按钮
- [ ] 首页加 hero section（标题 + 副标题 + CTA）
- [ ] 整体配色、间距、loading 状态打磨

**验收**：
- [ ] History 显示所有历史记录，按时间倒序
- [ ] 每条卡片信息完整
- [ ] 点击展开看大图
- [ ] 空状态友好
- [ ] 整体视觉不像 placeholder

**commits**：`feat: history page` / `feat: UI polish -- hero, navbar, empty states`

---

### Day 7：部署 + 端到端验证

**目标**：上线 Vercel，完整流程跑通。

**关键步骤**：
- [ ] 推送到 GitHub
- [ ] Vercel 关联仓库，部署
- [ ] **Vercel 环境变量按 `.env.example` 顺序全部填入生产值**（Clerk production keys / Supabase / R2 / OpenAI / Stripe）
- [ ] Clerk：配置 Production origins + redirect URLs（生产域名）
- [ ] Stripe：Webhook endpoint 改为 `https://<domain>/api/stripe-webhook`，记录生产 signing secret 填到 Vercel
- [ ] R2：绑定自定义域名（如 `tattoo-images.yourdomain.com`）
- [ ] 自定义域名绑定 Vercel + DNS

**端到端验证清单**：
- [ ] 生产域名可访问
- [ ] Google 登录成功
- [ ] 上传照片成功
- [ ] 生成 4 张图（10–15 秒）
- [ ] credits 扣减正确
- [ ] 购买 credits，支付成功，余额增加
- [ ] 历史记录可见
- [ ] 移动端基本可用

**commits**：`chore: production environment configuration` / `docs: deployment README`

---

## 风险与应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| **AI 融合效果差**（贴纸感/部位错位） | 中 | 致命 | Day 3 设效果门槛（60% 通过率），未达则调 prompt/mask/quality 或换 Flux Kontext |
| **gpt-image-1 多图 edit SDK 不支持** | 低 | 中 | 降级为单图 edit + prompt 描述纹身图案 |
| **OpenAI 限流/账号问题** | 低 | 高 | 提前确认账户可用 + 申请 gpt-image-1 权限；备选 Replicate |
| **Stripe webhook 重复发放 credits** | 中 | 中 | webhook 内先查 `payments.status`，已 paid 直接返回 200 |
| **R2 公开 URL 被遍历** | 低 | 低 | 用 UUID 路径（已设计）；如需更高安全后再改预签名 URL |
| **Vercel 函数超时**（默认 10s） | 中 | 中 | 升级到 Vercel Pro（60s 超时）；或在 generate 改异步轮询模式 |
| **SEO 流量起不来** | 高 | 中 | MVP 不依赖 SEO（靠 Reddit/Pinterest/TikTok 投放），第 3 周再补博客 |

**关于 Vercel 函数超时**：单次生成 8–13 秒，可能超过 Vercel Hobby 的 10s 限制。Day 7 部署时若发现超时，立即升级 Vercel Pro（$20/月，60s 超时）。长期方案是把生成改为异步（创建 job → 轮询状态），但 MVP 不做。

---

## 验证（Verification）

### 端到端用户旅程（Day 7 必须全绿）

1. 访问首页 → 看到 hero + 生成器
2. 点击 Sign Up → Google 登录成功
3. 上传一张身体照片 → 显示缩略图
4. 输入 "dragon + japanese style" → 点击 Generate
5. 10–15 秒后看到 4 张融合图（左臂/右臂/肩膀/小腿）
6. 顶栏 credits 从 1 变成 0
7. 再次点击 Generate → 提示"购买 credits"
8. 点击购买 → 跳转 Stripe → 测试卡支付成功
9. 跳回网站，credits 变成 5
10. 再次生成 → 成功
11. 访问 /history → 看到刚才 2 次生成记录

### 单元/集成测试策略

MVP 阶段**不强制 TDD**（节奏太快）。但以下必须手动验证：
- credits 原子扣减（开 2 个 tab 同时点 Generate，只有一个成功）
- webhook 重复发放（用 `stripe trigger` 多次触发同一 event）
- 未登录访问受保护 API → 401
- credits 不足 → 402
- 并发生成 → 429

### 成功标准（30 天内回答）

> 世界上是否有人愿意为"AI 纹身预览"付费？

如果 Day 7 上线后 3 周内：
- 有 ≥ 10 个真实付费用户 → **继续做**（扩展 Tattoo Planner、博客 SEO）
- 0 付费但有大量免费试用 → **调定价/产品**（可能定价高或效果差）
- 0 付费也没人试用 → **换方向**（SEO 没起来 / 投放渠道错）
