# Waffo Refund Handling Plan

**Goal:** Handle full refund webhooks and revoke only the refunded order's unused credits. Partial refunds are recorded for manual handling, as explicitly chosen by the user.
**Architecture:** Real RSA verification -> normalized refund identity -> user/order locked transaction -> dedicated order.refund_info ledger plus grant revocation. Preserve original payment_result. Add one nullable column with idempotent production preparation. Do not add a new table or touch production balances manually.
**Tech stack:** Next.js, Waffo SDK, Drizzle/PostgreSQL.

- [x] Reproduce full refund ignored with signed route/database tests; cover partial/failed, duplicates/concurrency, identity/currency mismatches, refund-before-payment, late payment and failed-generation compensation.
- [x] Normalize refund amounts separately (refundedAmount/amount are refund value; total is original payment). Support orderMetadata.order_no and external order reference; reject ambiguous matching.
- [x] Add order.refund_info, idempotent migration, transactional refund service and terminal refunded order/grant states. Serialize with consumption's user lock. Prevent late fulfillment and failed-generation compensation from restoring refunded credits.
- [x] Preserve original payment history. Record partial refunds as manual_review without automatic deductions; record failures without deductions. Validate paid amount and exact provider transaction identity.
- [ ] Run isolated migrations twice, full tests/types/lint/build, review, push to shipany-two. Confirm CI/deployment. Tell user to enable refund.succeeded/refund.failed subscriptions and re-deliver genuine historical events; never claim historical recovery without evidence.

**Validation so far:** 129 tests passed sequentially, typecheck and baseline lint passed; independent review found no remaining blocker. Production build and deploy pending. Local concurrent test runs exhausted V8 native memory; rerun one worker completed successfully.

**Pre-push validation:** Full isolated suite 129 passed; subsequent webhook suite including the added late-amount audit regression 21 passed. Final typecheck passed, lint 0 new errors. Webpack compilation passed, but local complete build workers exhausted Windows/V8 commit memory (default and 4GB). Do not describe the local complete build as passing; await Linux CI and Vercel production build/preparation results.
