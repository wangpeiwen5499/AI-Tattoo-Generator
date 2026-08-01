# 游客免费试用 + 注册送 3 次 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐 task 执行。步骤用 `- [ ]` 复选框跟踪。
>
> **依据**：`docs/superpowers/specs/2026-08-01-guest-free-trial-design.md`（已与用户确认）。

**Goal:** 未登录游客可免费生成 1 次；新注册用户 credits 1→3。

**Architecture:** Cookie guest ID（`guest_<uuid>`）作 `users.id`，复用现有 `deduct/add_credits` RPC；middleware 发 cookie，`getActor()` 统一身份；游客生成走 `claim_guest_free` RPC（每 IP 3 次/天，行锁原子）；游客数据不迁移。

**Tech Stack:** Next.js 16.2.10（`cookies()`/`headers()` async）、Clerk、Supabase（service_role）、R2、KIE。

## Global Constraints

- 所有回答与 **commit message 用中文**（`CLAUDE.md`）；每个 commit 末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。
- **项目无测试框架**：验证用 `npm run lint` + `npm run build` + 手动，**不强加 unit test**。
- **migration `0003_guest_free.sql` 需用户在 Supabase Dashboard > SQL Editor 手动执行**（Task 1 只写文件，不自动跑）。
- **`ensureGuest` 必须用 `ignoreDuplicates: true`**：upsert `{credits:1}` 会重置已存在游客 credits（刷漏洞）；用 ignoreDuplicates 确保"首次 insert credits=1，已存在不动"。这是对 spec §4.3 的实现修正。
- Next.js 16 的 `cookies()` / `headers()` 是 **async**，需 `await`。
- `getActor()` 只在 Route Handler 用（用 `cookies()`）；middleware 用 `req.cookies` 发 cookie（Edge runtime）。
- 复用现有 `getCredits` / `deductCredits` / `refundCredits` / `createProject` / `recordGenerations` / `runGeneration`（都基于 `users.id`，对 user/guest 透明）。
- `FREE_SIGNUP_CREDITS` 常量 `1` → `3`（与 DB default 对齐）。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `supabase/migrations/0003_guest_free.sql` | **新建** | users default 3 + guest_free_usage 表 + claim_guest_free RPC |
| `src/server/auth/actor.ts` | **新建** | `getActor()`：auth→user，否则 cookie→guest |
| `src/server/db/ensure-user.ts` | **修改** | 加 `ensureGuest(id)`（ignoreDuplicates，不重置 credits） |
| `src/server/db/queries.ts` | **修改** | 加 `claimGuestFree(ip)` |
| `src/lib/constants.ts` | **修改** | `FREE_SIGNUP_CREDITS` 1→3 |
| `src/middleware.ts` | **修改** | 发 `guest_id` cookie |
| `src/app/api/upload-url/route.ts` | **修改** | auth → getActor |
| `src/app/api/generate/route.ts` | **修改** | getActor + 游客分支（ensureGuest + claimGuestFree） |
| `src/app/api/generate/status/route.ts` | **修改** | auth → getActor |
| `src/app/api/credits/route.ts` | **修改** | getActor（兼容游客） |
| `src/app/page.tsx` | **修改** | 生成器对所有人可见；"Try it free" 锚点滚动 |
| `src/components/tattoo-generator.tsx` | **修改** | 游客用完→注册 CTA（登录→Buy） |

---

## Task 1: migration `0003_guest_free.sql`

**Files:** Create `supabase/migrations/0003_guest_free.sql`

**Interfaces:**
- Produces: DB 改动（users default 3 + guest_free_usage 表 + claim_guest_free RPC）。Task 3/6 依赖。

- [ ] **Step 1: 新建 `supabase/migrations/0003_guest_free.sql`**

```sql
-- 0003: 游客免费试用 + 注册送 3 次
-- 需在 Supabase Dashboard > SQL Editor 手动执行

-- 1. 注册送 3 次（新行 default 3；老行不变）
alter table public.users alter column credits set default 3;

-- 2. 游客免费额度按 IP/天 限流
create table if not exists public.guest_free_usage (
    ip          text not null,
    used_date   date not null,
    count       integer not null default 0,
    primary key (ip, used_date)
);

-- 3. 原子认领一次游客免费额度：超限（≥3）返回 -1（不递增），否则 +1 返回新 count
--    for update 行锁防并发；先查后递增 → 超限不占额度
create or replace function public.claim_guest_free(p_ip text)
returns integer as $$
declare
    v_count integer;
    v_today date := current_date;
begin
    select count into v_count
    from public.guest_free_usage
    where ip = p_ip and used_date = v_today
    for update;

    if v_count is not null and v_count >= 3 then
        return -1;
    end if;

    insert into public.guest_free_usage (ip, used_date, count)
    values (p_ip, v_today, 1)
    on conflict (ip, used_date) do update set count = guest_free_usage.count + 1
    returning count into v_count;

    return v_count;
end;
$$ language plpgsql;
```

- [ ] **Step 2: 提醒用户去 Supabase 执行**

migration 文件写好即可 commit（不自动执行）。Task 6（generate 游客分支）依赖 RPC，需用户先在 Supabase Dashboard > SQL Editor 跑 `0003_guest_free.sql`。

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_guest_free.sql
git commit -m "feat: 加 0003 migration（注册送3 + 游客限流表/RPC）

- users.credits default 1→3（新注册送 3，老行不变）
- guest_free_usage 表（ip+date 主键）
- claim_guest_free RPC：行锁原子认领，每 IP/天 3 次上限，超限返回 -1 不占额度

需在 Supabase Dashboard 手动执行。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: `getActor()` + `ensureGuest()` + 常量

**Files:**
- Create: `src/server/auth/actor.ts`
- Modify: `src/server/db/ensure-user.ts`（加 `ensureGuest`）
- Modify: `src/lib/constants.ts`（`FREE_SIGNUP_CREDITS` 1→3）

**Interfaces:**
- Produces: `getActor(): Promise<Actor | null>`（Actor = `{type:'user'|'guest', id}`）；`ensureGuest(guestId): Promise<UserRow>`；`FREE_SIGNUP_CREDITS = 3`。Task 5/6/7/8 消费。

- [ ] **Step 1: 新建 `src/server/auth/actor.ts`**

```ts
import { auth } from '@clerk/nextjs/server'
import { cookies } from 'next/headers'

export type Actor =
  | { type: 'user'; id: string } // Clerk userId
  | { type: 'guest'; id: string } // guest_id cookie（guest_<uuid>）

/**
 * 统一身份：登录用 Clerk userId，未登录用 guest_id cookie。
 * 用于 Route Handler（用 next/headers cookies()）；middleware 单独用 req.cookies。
 * 返回 null = 无任何身份（middleware 应已发 cookie，罕见）。
 */
export async function getActor(): Promise<Actor | null> {
  const { userId } = await auth()
  if (userId) return { type: 'user', id: userId }

  const cookieStore = await cookies()
  const guestId = cookieStore.get('guest_id')?.value
  if (guestId) return { type: 'guest', id: guestId }

  return null
}
```

- [ ] **Step 2: `src/server/db/ensure-user.ts` 末尾追加 `ensureGuest`**

在文件末尾追加：
```ts

/**
 * 确保数据库存在该游客的记录（id = guest_<uuid>，由 cookie 发放）。
 *
 * ⚠️ 必须用 ignoreDuplicates: true：upsert {credits:1} 默认会 update 已存在行，
 *    把游客用完后的 credits=0 重置回 1（刷漏洞）。ignoreDuplicates 让首次
 *    insert 给 credits=1，已存在则不动。
 * email 用占位（users.email not null）。
 */
export async function ensureGuest(guestId: string): Promise<UserRow> {
  const supabaseAdmin = getSupabaseAdmin()
  await supabaseAdmin
    .from('users')
    .upsert(
      { id: guestId, email: `${guestId}@guest.local`, credits: 1 },
      { onConflict: 'id', ignoreDuplicates: true }
    )
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', guestId)
    .single<UserRow>()

  if (error) throw error
  if (!data) throw new Error(`ensureGuest: no row returned for ${guestId}`)
  return data
}
```

- [ ] **Step 3: `src/lib/constants.ts` 改 `FREE_SIGNUP_CREDITS`**

把：
```ts
/** 注册赠送 Credits 数量 */
export const FREE_SIGNUP_CREDITS = 1
```
改为：
```ts
/** 注册赠送 Credits 数量（与 users.credits DB default 对齐） */
export const FREE_SIGNUP_CREDITS = 3
```

- [ ] **Step 4: lint**

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add src/server/auth/actor.ts src/server/db/ensure-user.ts src/lib/constants.ts
git commit -m "feat: 加 getActor/ensureGuest + 注册送3常量

- actor.ts：getActor() 统一身份（登录 userId / 未登录 guest_id cookie）
- ensureGuest：ignoreDuplicates 不重置 credits（防刷），email 占位
- FREE_SIGNUP_CREDITS 1→3（与 DB default 对齐）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: `claimGuestFree(ip)` 封装

**Files:** Modify `src/server/db/queries.ts`（末尾追加）

**Interfaces:**
- Produces: `claimGuestFree(ip): Promise<number>`（-1=超限，正数=新 count）。Task 6 消费。

- [ ] **Step 1: `queries.ts` 末尾追加**

```ts

/**
 * 认领一次游客免费额度（按 IP/天 限流）。
 * 调 claim_guest_free RPC：超限（每 IP/天 ≥3）返回 -1（不占额度），否则 +1 返回新 count。
 */
export async function claimGuestFree(ip: string): Promise<number> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin.rpc('claim_guest_free', { p_ip: ip })
  if (error) throw error
  return data as number
}
```

- [ ] **Step 2: lint**

Run: `npm run lint`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add src/server/db/queries.ts
git commit -m "feat: 加 claimGuestFree 封装（调 claim_guest_free RPC）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: middleware 发 `guest_id` cookie

**Files:** Modify `src/middleware.ts`

**Interfaces:**
- Produces: 所有访问者拿到 `guest_id` cookie（无则发）。Task 2 的 `getActor` 依赖。

- [ ] **Step 1: 改 `src/middleware.ts`**

把整个文件替换为：
```ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// 只保护 /history 路由，首页和 sign-in/sign-up 公开
const isProtectedRoute = createRouteMatcher(['/history(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // 给所有访客发 guest_id cookie（登录用户也会拿到，无害——getActor 优先用 userId）。
  // 游客身份就靠它（guest_<uuid>）。
  const res = NextResponse.next()
  if (!req.cookies.get('guest_id')) {
    res.cookies.set('guest_id', `guest_${crypto.randomUUID()}`, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 年
      path: '/',
    })
  }
  return res
})

export const config = {
  matcher: [
    // 跳过 Next.js 内部请求和静态资源
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // 始终运行 middleware 于 API 路由
    '/(api|trpc)(.*)',
  ],
}
```

> `crypto.randomUUID()` 在 Edge runtime（Clerk middleware 跑 Edge）可用（Web Crypto API）。

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。

- [ ] **Step 3: 本地验证 cookie 发放**

`npm run dev` → 浏览器 DevTools > Application > Cookies > localhost:3000 → 看到 `guest_id: guest_<uuid>`（httpOnly）。

- [ ] **Step 4: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: middleware 给所有访客发 guest_id cookie

游客身份标识（guest_<uuid>），httpOnly 1 年。登录用户也发但 getActor 优先用 userId。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: `/api/upload-url` 改 getActor

**Files:** Modify `src/app/api/upload-url/route.ts`

**Interfaces:**
- Consumes: `getActor`（Task 2）、`ensureUser`、`ensureGuest`（Task 2）。
- Produces: `/api/upload-url` 兼容游客（用 actor.id 拼 R2 key）。

- [ ] **Step 1: 改 import + 鉴权段**

把：
```ts
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import { getUploadUrl, makeObjectKey } from '@/lib/r2'
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'
```
改为：
```ts
import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getActor } from '@/server/auth/actor'
import { ensureUser, ensureGuest } from '@/server/db/ensure-user'
import { getUploadUrl, makeObjectKey } from '@/lib/r2'
import { ALLOWED_UPLOAD_CONTENT_TYPES, MAX_UPLOAD_BYTES } from '@/lib/constants'
```

- [ ] **Step 2: 替换鉴权 + ensureUser 段（第 18-66 行的"1.验证登录"到"4.首次调用自动建用户记录"）**

把：
```ts
  // 1. 验证登录
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. 拿 email（用于 ensureUser）
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'Email is required. Please add an email in your account.' }, { status: 400 })
  }
```
改为：
```ts
  // 1. 身份：登录用 userId，游客用 guest_id cookie
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json({ error: 'Failed to identify session' }, { status: 500 })
  }
```

把：
```ts
  // 4. 首次调用自动建用户记录（送 1 credit）
  try {
    await ensureUser(userId, email)
  } catch (e) {
    console.error('[upload-url] ensureUser failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  // 5. 生成 R2 预签名上传 URL
  const ext = body.ext || contentType!.split('/')[1] || 'jpg'
  const key = makeObjectKey(userId, ext)
```
改为：
```ts
  // 4. 确保数据库有该身份的行（登录 ensureUser + email；游客 ensureGuest）
  try {
    if (actor.type === 'user') {
      const user = await currentUser()
      const email = user?.emailAddresses?.[0]?.emailAddress
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required. Please add an email in your account.' },
          { status: 400 }
        )
      }
      await ensureUser(actor.id, email)
    } else {
      await ensureGuest(actor.id)
    }
  } catch (e) {
    console.error('[upload-url] ensureUser/Guest failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  // 5. 生成 R2 预签名上传 URL（用 actor.id 拼 key）
  const ext = body.ext || contentType!.split('/')[1] || 'jpg'
  const key = makeObjectKey(actor.id, ext)
```

- [ ] **Step 3: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过（无 `userId`/`auth` 残留引用）。

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload-url/route.ts
git commit -m "feat: /api/upload-url 兼容游客（getActor + ensureGuest）

R2 key 用 actor.id（登录 userId / 游客 guest_id）。游客 ensureGuest 建 users 行。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: `/api/generate` 改 getActor + 游客分支

**Files:** Modify `src/app/api/generate/route.ts`

**Interfaces:**
- Consumes: `getActor`（Task 2）、`ensureGuest`（Task 2）、`claimGuestFree`（Task 3）。
- Produces: `/api/generate` 游客可生成（IP 限流 + credits 扣减）。

> 这是核心改造。现状（Task 改造前）：`auth()` → `ensureUser` → getCredits → deductCredits → createProject → after(runGeneration) → return projectId。改为 getActor + 游客分支（ensureGuest + claimGuestFree）。

- [ ] **Step 1: 改 import**

把：
```ts
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { ensureUser } from '@/server/db/ensure-user'
import {
  getCredits,
  deductCredits,
  refundCredits,
  createProject,
} from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { runGeneration } from '@/server/ai/run-generation'
```
改为：
```ts
import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { currentUser } from '@clerk/nextjs/server'
import { getActor } from '@/server/auth/actor'
import { ensureUser, ensureGuest } from '@/server/db/ensure-user'
import {
  getCredits,
  deductCredits,
  refundCredits,
  createProject,
  claimGuestFree,
} from '@/server/db/queries'
import { CREDITS_PER_GENERATION } from '@/lib/constants'
import { runGeneration } from '@/server/ai/run-generation'
```

- [ ] **Step 2: 替换鉴权段（"1. Clerk 鉴权 + ensureUser"）**

把：
```ts
  /* 1. Clerk 鉴权 + ensureUser */
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const email = user.emailAddresses?.[0]?.emailAddress
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }
```
改为：
```ts
  /* 1. 身份：登录 userId / 游客 guest_id */
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json({ error: 'Failed to identify session' }, { status: 500 })
  }
  const userId = actor.id
```
> `userId = actor.id` 让后续 createProject/runGeneration（用 userId）不用改名。

- [ ] **Step 3: 替换"3. ensureUser"段**

把：
```ts
  /* 3. ensureUser（首次入库 + 拿 credits 前置条件） */
  try {
    await ensureUser(userId, email)
  } catch (e) {
    console.error('[generate] ensureUser failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }
```
改为：
```ts
  /* 3. 确保数据库有该身份的行 + 游客 IP 限流 */
  try {
    if (actor.type === 'user') {
      const user = await currentUser()
      const email = user?.emailAddresses?.[0]?.emailAddress
      if (!email) {
        return NextResponse.json({ error: 'Email is required' }, { status: 400 })
      }
      await ensureUser(userId, email)
    } else {
      // 游客：建 users 行（credits=1，已存在不重置）
      await ensureGuest(userId)
    }
  } catch (e) {
    console.error('[generate] ensureUser/Guest failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  // 游客额外：每 IP 3 次/天 限流（在扣 credits 之前拦，超限不占额度）
  if (actor.type === 'guest') {
    try {
      const fwd = (await headers()).get('x-forwarded-for')
      const ip = fwd?.split(',')[0]?.trim() || 'unknown'
      const claimed = await claimGuestFree(ip)
      if (claimed === -1) {
        return NextResponse.json(
          { error: 'Guest free limit reached for today. Sign up for 3 more previews.' },
          { status: 429 }
        )
      }
    } catch (e) {
      console.error('[generate] claimGuestFree failed:', e)
      return NextResponse.json({ error: 'Failed to check guest limit' }, { status: 500 })
    }
  }
```

> 后续 getCredits/deductCredits/createProject/runGeneration 都用 `userId`(=actor.id)，不需改。游客 createProject 写 user_id=guest_id；runGeneration 收 userId=guest_id 正常跑。

- [ ] **Step 4: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过（无 `auth`/`email` 残留引用）。

- [ ] **Step 5: 手动验证（需用户先在 Supabase 跑 0003 migration）**

未登录访问 → 上传 → 生成：应秒回 projectId + 轮询出图（游客 credits=1）。第 2 次 → 402。同 IP 第 4 个 cookie → 429。

- [ ] **Step 6: Commit**

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: /api/generate 兼容游客（getActor + ensureGuest + IP 限流）

游客分支：ensureGuest 建 users 行（credits=1）+ claim_guest_free 每 IP/天 3 次
（超限 429 引导注册，不占额度）。登录分支不变。userId=actor.id 让下游不变。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: `/api/generate/status` 改 getActor

**Files:** Modify `src/app/api/generate/status/route.ts`

**Interfaces:**
- Consumes: `getActor`（Task 2）。
- Produces: status 校验 `project.user_id === actor.id`（user/guest 透明）。

- [ ] **Step 1: 改 import + 鉴权**

把：
```ts
import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { getProjectWithGenerations } from '@/server/db/queries'
```
改为：
```ts
import { NextResponse } from 'next/server'
import { getActor } from '@/server/auth/actor'
import { getProjectWithGenerations } from '@/server/db/queries'
```

把：
```ts
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const project = await getProjectWithGenerations(id)
  if (!project || project.user_id !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
```
改为：
```ts
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json({ error: 'Failed to identify session' }, { status: 500 })
  }

  const id = new URL(req.url).searchParams.get('id')
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  }

  const project = await getProjectWithGenerations(id)
  if (!project || project.user_id !== actor.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
```

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate/status/route.ts
git commit -m "refactor: /api/generate/status 用 getActor（兼容游客校验归属）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: `/api/credits` 改 getActor（兼容游客）

**Files:** Modify `src/app/api/credits/route.ts`

**Interfaces:**
- Consumes: `getActor`（Task 2）、`ensureGuest`（Task 2）。
- Produces: `/api/credits` 返回游客 credits（前端徽章用）。

- [ ] **Step 1: 改 import + 整个 GET**

把整个文件替换为：
```ts
import { NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { getActor } from '@/server/auth/actor'
import { ensureUser, ensureGuest } from '@/server/db/ensure-user'
import { getCredits } from '@/server/db/queries'
import type { CreditsResponse } from '@/types'

/**
 * GET /api/credits
 *
 * 返回当前身份（登录 userId / 游客 guest_id）的 credits 余额。
 * 副作用：首次调用 ensureUser/ensureGuest 建行（注册送 3 / 游客送 1）。
 *
 * 响应：200 { credits: number } / 500 服务端错误
 */
export async function GET(): Promise<Response> {
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json({ error: 'Failed to identify session' }, { status: 500 })
  }

  try {
    if (actor.type === 'user') {
      const user = await currentUser()
      const email = user?.emailAddresses?.[0]?.emailAddress
      if (!email) {
        return NextResponse.json(
          { error: 'Email is required. Please add an email in your account.' },
          { status: 400 }
        )
      }
      await ensureUser(actor.id, email)
    } else {
      await ensureGuest(actor.id)
    }
  } catch (e) {
    console.error('[credits] ensureUser/Guest failed:', e)
    return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 })
  }

  try {
    const credits = await getCredits(actor.id)
    return NextResponse.json({ credits } satisfies CreditsResponse)
  } catch (e) {
    console.error('[credits] getCredits failed:', e)
    return NextResponse.json({ error: 'Failed to fetch credits' }, { status: 500 })
  }
}
```

- [ ] **Step 2: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。

- [ ] **Step 3: Commit**

```bash
git add src/app/api/credits/route.ts
git commit -m "feat: /api/credits 兼容游客（getActor + ensureGuest）

游客返回其 credits（默认 1）供前端徽章显示。登录分支不变。

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: 前端 — 生成器对所有人可见 + 游客用完引导注册

**Files:**
- Modify: `src/app/page.tsx`（生成器移出 signed-in Show；"Try it free" 锚点滚动）
- Modify: `src/components/tattoo-generator.tsx`（游客用完→注册 CTA，登录→Buy）

**Interfaces:**
- Consumes: Clerk `useUser`（判断登录态）。

> 关键 UX：游客在首页直接看到生成器（credits=1）能试；用完/IP 限流 → 引导注册（注册送 3）。

- [ ] **Step 1: `src/app/page.tsx` — 生成器对所有人可见 + "Try it free" 锚点**

把 signed-in 的生成器 Show：
```tsx
      <Show when="signed-in">
        <div className="mt-10">
          <TattooGenerator />
        </div>
      </Show>
```
替换为（去掉 Show，所有人可见，加锚点 id）：
```tsx
      <section id="generate" className="mt-10 scroll-mt-20">
        <TattooGenerator />
      </section>
```

把 hero 里 signed-out 的 "Try it free" 按钮（SignInButton）：
```tsx
        <Show when="signed-out">
          <div className="mt-8 flex items-center justify-center gap-3">
            <SignInButton mode="modal">
              <Button size="lg">Try it free</Button>
            </SignInButton>
            <Button size="lg" variant="outline" render={<Link href="#examples" />}>
              See examples
            </Button>
          </div>
```
替换为（"Try it free" 改成锚点滚动到生成器）：
```tsx
        <Show when="signed-out">
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button size="lg" render={<Link href="#generate" />}>
              Try it free
            </Button>
            <Button size="lg" variant="outline" render={<Link href="#examples" />}>
              See examples
            </Button>
          </div>
```

> `SignInButton` 不再用于 hero（如 page.tsx 别处没用，可删 import；lint 会提示）。signed-in 用户进首页直接用生成器（无需 Try it free 按钮，那是 signed-out 块）。

- [ ] **Step 1b: hero 文案对齐（游客 1 次 + 注册 3 次）**

把 hero 里：
```tsx
          <p className="mt-4 text-xs text-muted-foreground">
            1 free generation on sign up · No credit card required
          </p>
```
改为：
```tsx
          <p className="mt-4 text-xs text-muted-foreground">
            Try 1 free preview · 3 more on sign up · No credit card required
          </p>
```

- [ ] **Step 2: `src/app/page.tsx` — 清理未用 import**

如果 `SignInButton` 不再被引用（Step 1 移除后），把 import 里的 `SignInButton` 去掉：
```tsx
import { SignInButton, Show } from '@clerk/nextjs'
```
改为：
```tsx
import { Show } from '@clerk/nextjs'
```
（lint 会报 unused，按提示删。）

- [ ] **Step 3: `src/components/tattoo-generator.tsx` — 游客用完 → 注册 CTA**

import 加 `useUser`：
```tsx
import { useUser } from '@clerk/nextjs'
```
（放在现有 import 合适位置。）

组件内拿登录态：
```tsx
export function TattooGenerator() {
  const router = useRouter()
  const credits = useCredits()
  const gen = useGeneration()
  const { isSignedIn } = useUser()
```

把 `handleGenerate` 里余额不足的 toast：
```tsx
    if (credits.credits < CREDITS_PER_GENERATION) {
      toast.error("You're out of credits", {
        description: 'Buy credits to keep generating',
        action: {
          label: 'Buy Credits',
          onClick: () => router.push('/pricing'),
        },
      })
      return
    }
```
替换为（区分游客/登录）：
```tsx
    if (credits.credits < CREDITS_PER_GENERATION) {
      if (isSignedIn) {
        toast.error("You're out of credits", {
          description: 'Buy credits to keep generating',
          action: { label: 'Buy Credits', onClick: () => router.push('/pricing') },
        })
      } else {
        toast.error("You've used your free preview", {
          description: 'Sign up to get 3 more previews',
          action: { label: 'Sign up', onClick: () => router.push('/sign-up') },
        })
      }
      return
    }
```

- [ ] **Step 4: lint + build**

Run: `npm run lint && npm run build`
Expected: 全过。

- [ ] **Step 5: 手动验证**

- 未登录首页：Hero"Try it free"→ 滚到生成器；credits 徽章显示 1；能上传+生成 1 次。
- 游客用完（credits=0）→ toast"Sign up"按钮。
- 登录用户：生成器照常；out of credits → "Buy Credits"。

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/components/tattoo-generator.tsx
git commit -m "feat: 前端开放游客试用 + 用完引导注册

- page.tsx：生成器对所有人可见（id=generate）；'Try it free' 锚点滚动到生成器
- tattoo-generator：余额不足时游客→Sign up CTA（注册送3），登录→Buy Credits

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: 全量 build + lint 验证收口

**Files:** 无（仅验证）

- [ ] **Step 1: 全量 lint + build**

Run: `npm run lint && npm run build`
Expected: 全过（仅已知 middleware 弃用警告）。

- [ ] **Step 2: grep 确认无残留旧 auth()**

Run:
```bash
git grep -nE "await auth\(\)" -- src/app/api/upload-url/route.ts src/app/api/generate/route.ts src/app/api/generate/status/route.ts src/app/api/credits/route.ts
```
Expected: `No matches found`（4 个 API 都改用 getActor，无 `await auth()` 残留）。

- [ ] **Step 3: 端到端验证（需用户在 Supabase 跑 0003 migration）**

对照 spec §10 验证清单：
- [ ] 未登录首页 → guest_id cookie；Generate 跑完 1 次
- [ ] 游客第 2 次 → 402 → "Sign up" toast
- [ ] 同 IP 第 4 个 cookie → 429 → "Sign up" toast
- [ ] 新注册 credits=3；老用户不变
- [ ] 游客 project 在 guest_id 名下，登录后 /history 看不到（不迁移）
- [ ] 登录用户生成不受影响

- [ ] **Step 4: 若 Step 1-2 全过且无需补救，无需额外 commit**；若 build 报错，回对应 Task 修复后 `fix:` commit。

---

## 验证清单（对照 spec §10）

- [x 计划覆盖] lint + build 全过 → Task 10
- [x 计划覆盖] migration 在 Supabase 执行 → Task 1（用户跑）
- [x 计划覆盖] 未登录 Generate 跑完 1 次 → Task 6/9
- [x 计划覆盖] 游客第 2 次 → 402 + 引导注册 → Task 6/9
- [x 计划覆盖] 同 IP 第 4 次 → 429 → Task 6
- [x 计划覆盖] 新注册 credits=3 → Task 1（DB default）+ Task 2（常量）
- [x 计划覆盖] 游客 project 不迁移 → 设计层面（不迁移逻辑，无代码）
- [x 计划覆盖] 登录用户不受影响 → Task 6（user 分支保留现状）

---

## 风险与注意事项

1. **migration 必须先跑**：Task 6/10 依赖 `claim_guest_free` RPC + `guest_free_usage` 表。用户需在 Supabase Dashboard 跑 `0003_guest_free.sql` 后，游客生成才工作。
2. **`ensureGuest` 用 ignoreDuplicates**：Task 2 Step 2 已强调（防重置 credits 刷漏洞）。spec §4.3 的简化版已在此 plan 修正。
3. **middleware 在 clerkMiddleware 回调 return response**：Task 4 的 set cookie 靠 `return NextResponse.next()` with cookies。Clerk middleware 支持回调 return response（用于 redirect/cookie）。实施时若 Clerk 不支持，改用 `next/headers` 在 layout 发 cookie（备选）。
4. **`getActor` 用 `await cookies()`**：Next.js 16 的 `cookies()` async。Task 2 已 `await`。
5. **游客照片/数据清理**：不做（spec 非目标）。游客 project 留 guest_id，占 DB + R2，无害。后续可加 cron 清理 >30 天的 guest_id 数据。
6. **防刷现实**：IP 限流每 IP 3 次/天 = 单 IP 每天最多烧 $0.45。代理/VPN 可绕过。这是接受的代价（spec §3）。
7. **`x-forwarded-for` 缺失**：兜底 `'unknown'`（所有这类请求共享，可能误伤，可接受）。
