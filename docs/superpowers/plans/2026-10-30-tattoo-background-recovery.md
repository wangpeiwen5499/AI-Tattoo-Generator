# Independent tattoo generation and recovery

Goal: leaving /generate must not stop provider result collection; History must resume a specific task without a second debit. Four body tasks should start together and available results should appear immediately.

Architecture: preserve tattoo_job leases, request idempotency and exact-credit reversal. Add a Vercel Workflow runner with durable sleeps and short database-backed steps. Persist run IDs for deduplication/recovery, expose safe authenticated progress, and reconcile already-submitted provider results before timeout settlement. Browser polls display state rather than being the only engine.

- [x] Regression tests: four body submissions in one advance, partial persisted results, timeout reconciliation of existing KIE IDs without new billable tasks, browser remount/project selection.
- [x] Update job engine; add workflow step/runner + additive run metadata upgrade and Next integration; schedule at task start and recovery.
- [x] Add specific-project restore, live History detail, pending states, homepage resume link and progressive images. Preserve billing and refund safeguards.
- [ ] Verify the reported private production task with authenticated recovery/read-only SQL; never invent production state or reissue upstream tasks.
- [ ] Full tests/type/lint/build, review and GitHub automatic deployment verification.

Local verification: 162 tests pass, TypeScript passes, lint has no new errors, full webpack production build passes, and progressive preview UI was checked with test responses. Production deployment verification remains pending push.
