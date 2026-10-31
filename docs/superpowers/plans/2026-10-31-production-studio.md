# Production placement studio implementation plan

> **For agentic workers:** Use subagent-driven development for independent server and browser adapters; root integrates and verifies.

**Goal:** Release the validated direct-placement workflow with account-owned persistence and authoritative real credits.

**Architecture:** Keep the isolated Preview lab for test deployments. Add an authenticated `/api/studio` service with persistent assets and idempotent jobs; reuse the existing credit ledger, R2 storage and Workflow runtime. Production studio uses a server-backed library/wallet adapter, never the local test wallet. Homepage, pricing, guides and navigation switch together to production language.

**Tech stack:** Next.js 16, PostgreSQL/Drizzle, Better Auth, R2, KIE, Vercel Workflow, static canvas studio.

**Spec:** Existing Preview prototype and user instructions in this conversation, including latest removal of legacy entry requirement.

## Global constraints

- No legacy entry. Existing balances remain numerically unchanged. Existing history remains accessible.
- New 1K design: 1 credit. Single try-on: 1/2/3 credits at 1K/2K/4K. Upload/save/reuse/manual placement free. Packs unchanged.
- Account authentication and email verification required for paid operations. Ownership enforced on every asset/job/library operation. No free local credit grants in production.
- Persist jobs before provider requests; idempotent operation IDs; never retry ambiguous provider task creation automatically. Failures restore exact consumed grant rows once. Browser closure must not lose a result.
- Production never uses KIE_LAB variables or lab tokens. Preview remains isolated from live persistence and billing.

## API contract

`GET /api/studio`: `{mode:'account', configured, signedIn, verified, userId?, credits, resolutions:['1K','2K','4K'], pending:[{task,kind,operationId,prompt,resolution}]}`.

`POST ?mode=upload` multipart `image`: `{asset: ownedAssetId}`.
`POST ?mode=design` JSON `{operationId,prompt}`: `{task:jobId}`.
`POST ?mode=render` JSON `{operationId,photo,design,guide,region,resolution,prompt?,designId?}`: `{task:jobId}`.
`POST ?mode=status` JSON `{task}`: `{state, failed?, asset?, operationId, kind, designId?, historyId?}`.
`GET ?asset=id`: owned image proxy, private/no-store.
`GET ?collection=designs|history`: `{records:[{id,operationId?,name?,prompt,source?,resolution?,createdAt,image:assetId,original?:assetId,draft?:assetId,designId?}]}`.
`POST ?mode=save-design` multipart `image,name,prompt,source`: `{record: metadata}` (free uploaded/sample design save).
`DELETE ?collection=designs|history&id=recordId`: ownership-scoped logical removal; no deleting shared history assets.

Generated designs and render history are saved by the server before success. Client save methods only resolve existing records by operationId; they must not duplicate uploads or charge. Pending local draft snapshots may remain browser-only for editing convenience, scoped to account, and are never authoritative.

## Tasks

- [ ] Server: additive schema/migration, owned assets/library, credit lifecycle and durable jobs, API contract with adversarial tests.
- [ ] Browser: account library/wallet adapter and studio runtime mode, sign-in/verification/pricing guidance, resume server pending jobs after reload, remove lab/test copy in live mode.
- [ ] Product: production homepage/pricing/SEO/navigation/design/history routing, payment descriptions and policy consistency. No old generator navigation; legacy history retained read-only.
- [ ] Verification: full tests/types/lint/build in both environments; mocked browser flow; code review; deploy via production Git branch after checks; verify live pages and isolation.

## Review focus

- Cross-user asset reads/deletes/job status requests never leak data.
- Repeated requests and parallel tabs cannot debit or submit twice.
- Closed browser/provider errors/storage failure retain a recoverable job and do not falsely show success.
- Refund reversal only restores the original consumed grants and never revives a refunded order.
- Logged-out/free local controls never reach billable provider calls or grant real credits.
