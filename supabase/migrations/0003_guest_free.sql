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
