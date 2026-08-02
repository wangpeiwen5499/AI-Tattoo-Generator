-- 0004: payments 表 Creem 列重命名为 Waffo
-- 在 Supabase Dashboard > SQL Editor 中执行此文件
-- UNIQUE 约束由 Postgres 自动保留；idx_payments_user_id 不涉及这两列，不动

alter table public.payments rename column creem_checkout_id to waffo_session_id;
alter table public.payments rename column creem_order_id     to waffo_order_id;
