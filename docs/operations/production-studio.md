# Account placement studio

## Production behavior

- `/generate`, `/designs`, `/history` open the shared canvas studio with the appropriate panel. `/history/archive` retains prior four-placement results; the old generation create endpoint returns 410 in Production.
- `/api/studio` is the authoritative production service. Verified accounts generate one 1K design for 1 credit and one 1K/2K/4K try-on for 1/2/3 credits. The existing credit ledger and purchase amounts remain unchanged. No balance conversion or extra gift is applied.
- `studio_asset`, `studio_record`, `studio_job` are added during the existing production preparation step. The migration is repeatable, serialized and additive. Prior user/payment/history tables are retained.
- Generated results are copied to R2 and their account records committed before a success response. Deleting a library record is a logical removal, preserving assets referenced by saved history or jobs. Account deletion/storage purge is a separate support operation.
- Every billable operation has an immutable UUID and original input. Repeated identical operations return the same job; changed input or cross-owner IDs are rejected. One in-flight/review job per account is allowed.
- A debit reserves credits when the server accepts the operation. Confirmed provider failures restore the exact original grant portions once. Refunded purchase grants are never revived. Failed storage is retried from the saved provider result without issuing a new paid generation.
- Workflow executes independently of the browser. `/api/internal/tattoo-jobs` also advances due studio jobs if an existing scheduler calls it using `CRON_SECRET`. GET capabilities/status can restart a stopped worker.
- Uploads require verified email, image decoding, size/pixel limits and ownership. Maximum 100 uploaded asset rows per account over 24 hours, with one-second pacing. Output proxy responses are private/no-store. Provider output URLs are allowlisted.

## Ambiguous provider submission / long tasks

An interrupted or unconfirmed paid create request enters `review_required`, retaining the held credit. It is never automatically resubmitted. Jobs exceeding one hour also enter review with provider ID/result URL preserved. Ask the user for the task ID and inspect the provider before resolving.

Administrator route: same-origin `POST /api/studio/admin`; authenticated admin must have both `admin.access` and `admin.credits.write`.

```json
{"task":"studio job UUID","action":"attach","providerTaskId":"confirmed provider task ID"}
```

Attach only a provider task verified to belong to this operation. This renews the recovery window and resumes storing directly if the result URL was already saved.

```json
{"task":"studio job UUID","action":"refund"}
```

Refund only after reviewing provider status; it restores original grant portions once and releases the blocked account. The credit consumption/refund records remain in the ledger. Do not send secrets to the browser or use this endpoint without the authenticated permission check.

## Environment and isolation

Production reuses `DATABASE_URL`, `KIE_API_KEY`, existing `R2_*` and Better Auth settings. No `KIE_LAB_*` value is used. Studio requests have a 90-second platform allowance and bounded external timeouts. Workflow is the primary durable runner; the cron runner is an optional recovery path with existing scheduler configuration.

Preview continues using `/api/preview/try-on`, browser-local designs/history and a simulated wallet. `/api/studio` refuses Preview paid requests and never reads or writes its live account data there. Production rejects lab requests with 404 and removes free test top-up/token controls from its working UI.

## Merchant synchronization

The owner chose to apply Waffo product descriptions and replacement covers manually. Use `docs/commerce/waffo-products.md`; IDs, prices and credit amounts must stay unchanged. Local fixed-image-count covers are historical and must not be reused for the new terms. No merchant configuration or email delivery is performed by this release.

## Validation record

Automated service tests use isolated PGlite and mocked provider/R2 responses. They cover duplicate/parallel submits, ownership, exact refunds, durable recovery, storage retries, upload quota and Preview isolation. Browser verification uses mocked account/provider results and real local image assets; it does not spend customer credits or provider quota. Production smoke checks are read-only/anonymous. A real paid image remains an owner-operated acceptance check after release.
