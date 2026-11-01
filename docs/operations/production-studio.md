# TattooVis account studio

The production workflow is `/studio` (`/generate` redirects there): body photo → uploaded/generated/saved design → free placement → one realistic AI try-on. `/designs` and `/history` use the account library. Prior four-placement results remain readable at `/history/archive` and their existing detail URLs; the old generation create endpoint returns 410 in Production. Old in-flight jobs retain their status/recovery routes and durable worker.

## Credits and storage

- A new 1K design costs 1 credit. One 1K / 2K / 4K try-on costs 1 / 2 / 3 credits.
- Uploading, saving, reusing and positioning designs are free. Generated designs/results are saved automatically before task success is returned.
- Reuses the existing credit ledger, welcome grant, product IDs and payment/refund implementation. No balances are converted and no extra gift is applied.
- React keeps unsubmitted placement edits in memory only. There is no browser image library or simulated wallet. Authenticated uploads are saved to the account; render inputs include original/design/guide assets and the placement transform, allowing task and history recovery on another device.
- Assets are owned by a user. Private/no-store API proxies enforce that ownership. The backing R2 URLs are not a guarantee of private storage; existing privacy disclosures still apply.

## Deployment

GitHub auto-deployment runs `npm run deploy:prepare` before the build. `applyStudioUpgrade` adds `studio_asset`, `studio_record` and `studio_job` using a repeatable, serialized transaction. Existing account, credit, order and history data are retained. Production reuses `DATABASE_URL`, `KIE_API_KEY`, `R2_*` and the existing authentication settings; no OAuth or secret changes are required.

Preview account access remains disabled unless `VERCEL_ENV=preview` and `PREVIEW_STUDIO_ISOLATED=1` certify isolated resources. It never silently falls back to mock credits or browser-local account storage.

## Durable jobs and support

The server validates ownership and verification before reserving credits. A globally unique operation ID prevents duplicate accepted requests from being charged twice. A DB lease serializes advancement. Workflow runs independently of the browser, and the authenticated scheduler endpoint also advances studio jobs. Returning to the studio exposes pending account tasks for resumption.

Confirmed provider failure restores the original consumed grant portions exactly once; separately refunded purchase grants are not revived. Storage retries reuse the provider result without another generation. An unconfirmed/interrupted submission or a prolonged task enters `review_required`, holds its charge and prevents an automatic duplicate create.

Support may use same-origin `POST /api/studio/admin`, authenticated with both `admin.access` and `admin.credits.write`, after inspecting provider records:

```json
{"task":"studio-job-uuid","action":"attach","providerTaskId":"confirmed-provider-task-id"}
```

```json
{"task":"studio-job-uuid","action":"refund"}
```

Never attach an unverified provider task. Record removal is logical; shared assets and historical results remain independent. Full account/storage deletion remains a separate operation.

## Verification and commerce

Service tests use PGlite with mocked provider/R2 responses. Browser flow checks use mock account API responses and static case assets, without real purchases or paid generation. A real production render is an owner-operated acceptance test.

Waffo descriptions and artwork are manually maintained by the owner using `docs/commerce/waffo-products.md`. Prices and credit quantities stay unchanged; fixed sets/body-part/image-count promises must be removed from merchant copy too.
