# Waffo payment delivery and diagnosis

## Required notification setup

Register an HTTP webhook on the same Waffo store and Production environment as the production product:

`https://tattoovis.ink/api/payment/notify/waffo`

Subscribe to `order.completed` for one-time credit packs. Test and Production webhook registrations are independent. Checkout metadata must contain the website order_no and user_id. Website orders are in `public."order"`; payment grants are in `public.credit`, not the legacy payments/users tables.

The 14.99 USD package grants 20 credits. Order creation and a browser redirect are not payment proof. The present Waffo provider does not implement a server-side session lookup: its getPaymentSession returns PROCESSING. Fulfillment depends on the signed order.completed notification.

## Retry verification

The installed SDK 0.17.0 defaults to a five-minute signature tolerance. Waffo retains the original signature timestamp for automatic retries; the final retry can arrive after 31 minutes. The provider explicitly uses the official recommended 45-minute window, preserving RSA signature verification. Order-row locking and order-linked credit lookup keep duplicate successful deliveries idempotent.

Reference: https://docs.waffo.ai/api-reference/webhooks

## Incident diagnosis and recovery

1. Confirm the provider transaction is paid and map its orderMetadata.order_no to exactly one website order. Two website checkout attempts may correspond to just one paid transaction.
2. Read order status, payment_session_id, transaction_id, credits_amount and order-linked credit rows. `created` with no transaction/grant means payment confirmation has not completed; it does not identify whether delivery, verification or processing failed.
3. Inspect the Production webhook URL, subscription, delivery HTTP status and response. Do not use fabricated sample events to fulfill a real order.
4. Restore the genuine signed delivery through the provider's supported tools. Events with stale signatures may still fail; do not disable signature verification or widen the window to days to force historical events through.
5. If a verified historical transaction needs separate reconciliation, persist its exact transaction identity and use the existing atomic, idempotent order+grant path. Do not grant both checkout attempts or blindly increment the spent signup gift.
6. Verify the actual order is paid and has one payment grant of 20; the abandoned checkout must not receive a grant.

Tests in tests/waffo-webhook.test.ts exercise the real SDK signature check, route, fulfillment service and PostgreSQL adapter with isolated test keys/data. No production webhook or balance is modified by those tests.


## Refund handling (full refunds automatic; partial refunds manual)

Production webhook subscriptions must include `order.completed`, `refund.succeeded` and `refund.failed`, on the production store/environment. They use the same signed endpoint. A `200` on an old deployment did not mean a refund had been applied: the prior route acknowledged but ignored refunds. Genuine historical events must be redelivered after the new deployment or reconciled individually from verified provider evidence; this change does not automatically scan historical provider refunds.

- One successful full-refund event clears only the matched order's remaining grants and records the order/grant as refunded. Already-spent credits do not become debt, and signup/courtesy gifts and other orders are untouched.
- Partial refunds are recorded in `order.refund_info` with `manualReview=true`; no automatic proportional deduction. Several partial refunds summing to the full charge remain manual, as explicitly requested.
- Failed refund events are recorded without changing credits. Missing refund/original amounts are marked for review until sufficient payment evidence arrives.
- `refundedAmount` (legacy fallback `amount`) is the refunded value; `total` is the original price snapshot and must not be mistaken for a partial refund amount. Full-refund comparison uses the actual original charge, including `chargedAmount` on payment events.
- Matching requires the exact website order reference or an unambiguous provider transaction ID, plus provider/currency/transaction consistency. It never guesses by email or package price.
- Repeated/concurrent notifications are serialized user -> order -> grants and recorded by refund ID and status. Late payment notifications cannot regrant a fully refunded purchase. A later failed-generation compensation cannot restore a refunded grant.
- Original payment payload is retained; unused-credit revocation gets a separate `revoke` ledger row. Refund event metadata retains recovered credits and manual-review state. Admin Payments shows refund handling status and a refunded-order filter. Customer payment history retains refunded orders.

### Additive production upgrade

`npm run deploy:prepare` adds nullable `order.refund_info text` with `ADD COLUMN IF NOT EXISTS`, under an advisory transaction lock, after existing prerequisites. No table is dropped or cleared. Repeated preparation is safe. Local/preview builds do not touch production DB. Existing deployments can ignore the new nullable column if rollback is needed.

### Historical verification

After the new deployment is confirmed, resend the actual successful refund event from Waffo and check the order's status/refund_info, its grant status/remaining_credits, and the user's available balance. Do not use a sample test event for a real user's order. If Waffo preserves an old signature outside the 45-minute window, do not disable verification; use a verified one-off reconciliation instead.
