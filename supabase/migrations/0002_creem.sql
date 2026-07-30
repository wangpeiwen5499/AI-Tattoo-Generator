-- 0002: payments 表 Stripe 列重命名为 Creem
-- 在 Supabase Dashboard > SQL Editor 中执行此文件
-- UNIQUE 约束由 Postgres 自动保留；idx_payments_user_id 不涉及这两列，不动

alter table public.payments rename column stripe_session_id     to creem_checkout_id;
alter table public.payments rename column stripe_payment_intent to creem_order_id;
