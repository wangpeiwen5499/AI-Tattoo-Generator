-- AI Tattoo Generator - 初始化 schema
-- 在 Supabase Dashboard > SQL Editor 中执行此文件

create extension if not exists "pgcrypto";

-- users：主键直接用 Clerk user ID（不走 Supabase Auth）
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
    body_photo_key  text not null,               -- R2 key（用户上传的原始身体照片）
    body_photo_url  text not null,
    prompt          text not null,
    status          text not null default 'pending', -- pending / processing / completed / failed
    error_message   text,
    created_at      timestamptz not null default now(),
    completed_at    timestamptz
);
create index if not exists idx_projects_user_id on public.projects(user_id, created_at desc);

-- generations：一个 project 下 4 张结果（left_arm / right_arm / shoulder / calf）
create table if not exists public.generations (
    id                  uuid primary key default gen_random_uuid(),
    project_id          uuid not null references public.projects(id) on delete cascade,
    user_id             text not null references public.users(id) on delete cascade,
    body_part           text not null,
    tattoo_image_key    text,                    -- Step1 生成的纹身图案（4 张共用）
    result_image_key    text,
    result_image_url    text,
    status              text not null default 'pending', -- pending / completed / failed
    created_at          timestamptz not null default now()
);
create index if not exists idx_generations_project_id on public.generations(project_id);
create index if not exists idx_generations_user_id on public.generations(user_id, created_at desc);

-- payments：Stripe 支付记录
create table if not exists public.payments (
    id                  uuid primary key default gen_random_uuid(),
    user_id             text not null references public.users(id) on delete cascade,
    stripe_session_id   text unique not null,
    stripe_payment_intent text,
    amount              integer not null,        -- 单位：分（499 = $4.99）
    credits_purchased   integer not null,
    status              text not null default 'pending', -- pending / paid / failed
    created_at          timestamptz not null default now(),
    paid_at             timestamptz
);
create index if not exists idx_payments_user_id on public.payments(user_id, created_at desc);

-- updated_at 自动更新触发器
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
    before update on public.users
    for each row execute function public.handle_updated_at();

-- 原子扣减 credits（行级检查 + update，防并发刷接口）
-- 余额不足时抛出异常，事务回滚
create or replace function public.deduct_credits(
    p_user_id text,
    p_amount integer
) returns void as $$
begin
    update public.users
    set credits = credits - p_amount
    where id = p_user_id and credits >= p_amount;
    if not found then
        raise exception 'Insufficient credits';
    end if;
end;
$$ language plpgsql;

-- 原子增加 credits（Stripe webhook 调用）
create or replace function public.add_credits(
    p_user_id text,
    p_amount integer
) returns void as $$
begin
    update public.users
    set credits = credits + p_amount
    where id = p_user_id;
end;
$$ language plpgsql;

-- 关于 RLS：
-- MVP 所有访问都走 Next.js API Route（已登录态）+ service_role key，
-- service_role 会绕过 RLS，真正的鉴权在 API 层（验证 Clerk session + userId 匹配）。
-- 因此这里不开启 RLS。如未来需要从浏览器直接访问（用 anon key），再补 RLS 策略。
