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
