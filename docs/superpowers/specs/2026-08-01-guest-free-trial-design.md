# 游客免费试用 + 注册送 3 次设计

> **日期**：2026-08-01
> **状态**：设计已与用户确认，待写实施计划
> **目标**：游客（未登录）可免费生成 1 次；注册送 3 次免费（原 1 次）。

---

## 1. 目标

1. **游客免费 1 次**：未登录用户能完整走一次"上传 → 描述 → 生成 4 部位预览"，不需注册。
2. **注册送 3 次**：新注册用户 credits 从 1 → 3（降低注册阻力）。
3. **防刷**：游客免费不能被无限薅（每次生成成本 $0.15 KIE credits）。

---

## 2. 现状约束（探索确认）

- `projects` / `generations` / `payments` 的 `user_id` 都 **FK 引用 `users(id)` on delete cascade** → 游客要生成，必须在 `users` 表有行。
- `deduct_credits(p_user_id, p_amount)` / `add_credits(p_user_id, p_amount)` RPC 都基于 `users.id`，**可复用**。
- `ensureUser(clerkUserId, email)`：upsert users by id，新行 `credits` 取 schema default（现 1）。
- 所有 API 现在都 `auth()` 拿 Clerk `userId`，无登录即 401。
- `users.email` is `not null` → 游客行需占位 email。

---

## 3. 已确认决策

| 决策点 | 选择 |
|---|---|
| 游客身份 | **Cookie guest ID**（httpOnly cookie `guest_id` = `guest_<uuid>`，不依赖 Clerk plan） |
| 防刷 | **每 IP 3 次/天**游客免费生成（超出要求注册） |
| 游客数据迁移 | **不迁移**（游客 project 留 guest_id，登录后新账号从 0） |
| 游客免费额度 | 1 次 |
| 注册免费额度 | 3 次（原 1 次） |
| 老用户（已注册） | credits 不补，只新注册送 3 |
| `/api/credits` | 兼容游客（返回 guest credits，徽章用） |

---

## 4. 身份（Cookie guest）

### 4.1 cookie 发放（middleware）
`src/middleware.ts`（Clerk middleware）末尾加：请求无 `guest_id` cookie → `response.cookies.set` 一个 httpOnly cookie：
- name: `guest_id`
- value: `guest_${randomUUID()}`
- httpOnly, sameSite=lax, maxAge=1 年

> 不判断 auth：登录用户也会拿到 guest cookie（无害，`getActorId` 优先用 userId）。这样首次访问任何页都有 guest_id，后续 API 能读。

### 4.2 getActorId 工具
新建 `src/server/auth/actor.ts`：
```ts
export type Actor =
  | { type: 'user'; id: string }     // Clerk userId
  | { type: 'guest'; id: string }    // guest_id cookie（guest_<uuid>）

export async function getActor(req: Request): Promise<Actor> {
  const { userId } = await auth()
  if (userId) return { type: 'user', id: userId }
  const guestId = req.headers.get('cookie')  // 解析 guest_id（或用 next/headers cookies()）
    ?.match(/guest_id=([^;]+)/)?.[1]
  if (guestId) return { type: 'guest', id: guestId }
  // 理论上 middleware 已发 cookie；兜底：拒绝（要求重新访问）
  throw new Error('No actor identity')
}
```
> 实际实现用 `cookies()`（next/headers，Route Handler 内可用）解析 guest_id。所有需要身份的 API 用 `getActor(req)` 拿统一 Actor，避免散落 `if (userId) ... else ...`。

### 4.3 ensureGuest
`src/server/db/ensure-user.ts` 加：
```ts
export async function ensureGuest(guestId: string): Promise<UserRow> {
  const supabaseAdmin = getSupabaseAdmin()
  const { data, error } = await supabaseAdmin
    .from('users')
    .upsert(
      { id: guestId, email: `${guestId}@guest.local`, credits: 1 },
      { onConflict: 'id' }
    )
    .select()
    .single()
  if (error) throw error
  return data as UserRow
}
```
> 游客行 email 占位 `guest_<uuid>@guest.local`；credits=1（首次 upsert 给 1，已存在不变）。复用 deduct_credits。

---

## 5. credits

- **注册送 3**：migration `alter table users alter column credits set default 3`（新行 3，老行不变）。`FREE_SIGNUP_CREDITS` 常量 `1` → `3`。
- **游客送 1**：`ensureGuest` insert 显式 `credits: 1`。
- `deduct_credits` / `add_credits` / `getCredits` 全复用（基于 `users.id`，对 user/guest 透明）。

---

## 6. 防刷（IP 限流，每 IP 3 次/天）

### 6.1 表 + RPC（migration）
```sql
create table if not exists public.guest_free_usage (
    ip          text not null,
    used_date   date not null,
    count       integer not null default 0,
    primary key (ip, used_date)
);

-- 原子认领一次游客免费额度：超限返回 -1（不递增），否则 +1 返回新 count
create or replace function public.claim_guest_free(p_ip text)
returns integer as $$
declare
    v_count integer;
    v_today date := current_date;
begin
    select count into v_count
    from public.guest_free_usage
    where ip = p_ip and used_date = v_today
    for update;  -- 行锁防并发
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

### 6.2 generate 游客分支
```ts
if (actor.type === 'guest') {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const { data } = await supabaseAdmin.rpc('claim_guest_free', { p_ip: ip })
  if (data === -1) {
    return NextResponse.json(
      { error: 'Guest free limit reached for today. Sign up for 3 more.' },
      { status: 429 }
    )
  }
}
```
> IP 从 `x-forwarded-for`（Vercel 注入）。`for update` 行锁 + 先查后递增 → 超限不占额度，并发安全。

---

## 7. API 改造

| API | 改造 |
|---|---|
| `middleware.ts` | 末尾发 `guest_id` cookie（无则发） |
| `/api/upload-url` | `getActor` → `id` 拼 R2 key（user/guest 透明） |
| `/api/generate` | `getActor`；guest 分支：`ensureGuest` + `claim_guest_free`（429 拒）+ deduct credits；user 分支：现状 |
| `/api/generate/status` | `getActor` → 校验 `project.user_id === actor.id`（user/guest 透明） |
| `/api/credits` | `getActor` → `getCredits(actor.id)`（兼容游客，徽章用） |
| `/api/checkout` | **不变**（仍 `auth()` 要求登录；游客用完引导注册） |
| `/history`（page） | **不变**（middleware 已要求登录；游客无历史） |

> `runGeneration` / `recordGenerations` / `updateProjectStatus` / `refundCredits` 都基于 `users.id` / `projectId`，对 user/guest 透明，**不需改**。

---

## 8. 前端

- **credits 徽章（`credits-badge.tsx` + `useCredits`）**：游客时 `/api/credits` 返回 1，徽章正常显示（或游客态文案 "Free trial"）。MVP：直接显示数字（1），简单。
- **Generate 用完 / IP 限流**：
  - 402（credits 不足）→ toast "Out of previews" + "Sign up for 3 more" 按钮（→ 注册）。
  - 429（IP 限流）→ toast "Daily guest limit reached" + "Sign up for 3 more" 按钮。
- **游客登录后**：Clerk 签发 session，`getActor` 走 user 分支；游客 cookie 留存无害；游客 project 留 guest_id（不迁移，看不到）。
- 落地页 hero "Try it free" 现在是真的（游客能试 1 次）。

---

## 9. 边界 / 错误处理

| 场景 | 处理 |
|---|---|
| 游客清 cookie | 新 guest_id（1 次），但 IP 限流拦同 IP 第 4 次 |
| 游客用完 1 次 | 下次 generate → 402 → 引导注册 |
| 同 IP 第 4 次（不同 cookie） | `claim_guest_free` 返回 -1 → 429 → 引导注册 |
| 游客 close 页面再开（同 cookie） | 仍能轮询上次 project（status 路由用 guest_id 校验）；但无 `/history` 入口（结果只在生成 session 内可见） |
| 游客 cookie 丢失（极端） | getActor throw → API 500；middleware 下次访问会重发。罕见。 |
| `x-forwarded-for` 缺 | 用 `'unknown'` 作 IP（所有这类请求共享 unknown，限流可能误伤，可接受） |
| 老用户 | credits 不补；只新注册 default 3 |

---

## 10. 验证清单

- [ ] `npm run lint && npm run build` 全过
- [ ] migration 在 Supabase 执行（users default 3 + guest_free_usage 表 + claim_guest_free RPC）
- [ ] 未登录访问首页 → 拿到 guest_id cookie；Generate 能跑完 1 次（上传→生成→status 轮询→出图）
- [ ] 游客第 2 次 generate → 402 → toast 引导注册
- [ ] 同 IP（不同 cookie）第 4 次 → 429 → 引导注册
- [ ] 新注册用户 credits=3；老用户不变
- [ ] 游客生成的 project 在 guest_id 名下，登录后 `/history` 看不到（不迁移）
- [ ] 登录用户生成走原流程，不受影响

---

## 11. 非目标（YAGNI）

- 不做游客数据迁移到正式账号（登录后从 0）。
- 不做游客 project / guest users 行定期清理（占 DB 无害，后续 cron）。
- 不做 CAPTCHA / 设备指纹（IP 限流够了）。
- 不做全局每日预算上限（IP 限流已限单 IP；大规模攻击后续再加）。
- 不改 `/api/checkout` / `/history`（仍要求登录）。
- 不做 Clerk 匿名用户（cookie guest 够 MVP）。
