# Background tattoo task recovery

## Why navigation used to stall a task

Only the generation page polled status, and each status request advanced one saved provider operation. No scheduler was configured. Leaving that page stopped result collection, even though already-submitted KIE work continued. History detail was a static database snapshot and offered no progress/resume route.

## Current execution

New tasks enqueue a Vercel Workflow before the start endpoint returns. Its durable steps advance the existing tattoo_job state and sleep five seconds between checks. The browser can close without cancelling this run. Job leases and immutable request IDs protect billable submissions. A saved workflow run ID avoids duplicate scheduling; visiting an active task can repair a failed runner.

If initial scheduling fails before provider work starts, the original debit is reversed transactionally and the job is marked failed. If a provider submission or worker is already running, it is preserved. Provider creation is never blindly retried after an ambiguous submission.

After the design is stored, all four body requests are submitted together. Small provider status requests run concurrently; high-resolution downloads remain serial and bounded. The job lease renews after every saved operation. Progress responses include each saved body result immediately, while terminal History rows are finalized transactionally.

## Navigation and recovery

- Homepage/landing pages show an authenticated resume notice for an active task.
- /generate discovers active work server-side; ?projectId= selects an owned specific task.
- /history/:id uses the same live progress/results view and checks ownership on both server rendering and status requests.
- Incomplete settled results have a “Check saved AI results — no credits charged” button. The authenticated POST only re-queries saved provider IDs. It creates no KIE jobs and consumes no credits. Existing reversed charges stay reversed; recovered History rows replace the previous body rows instead of duplicating them.
- Deadline settlement checks already-submitted KIE tasks before deciding which output is unavailable. Unsubmitted body placements are never started after the deadline.

## Production case awaiting authenticated verification

The reported production task requires authenticated owner verification. No production database credentials are available in this workspace. The patch must not be described as having recovered that specific task until the owner opens its detail/recovery action and the returned state is verified.

## Deployment and limits

Production preparation adds nullable workflow_run_id / workflow_checked_at to tattoo_job idempotently. No balances or packages are rewritten. withWorkflow generates the internal Vercel workflow handlers; proxy matcher already excludes dotted .well-known paths. The Workflow service adds durable execution usage; provider compute and queue time remain outside this application's control. Browser-independent execution does not guarantee upstream availability. Persisted IDs and explicit recovery remain the fallback for failed upstream requests.
