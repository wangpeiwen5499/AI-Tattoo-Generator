# Website Audit Remediation Implementation Plan

**Goal:** Implement approved audit items 01–14 and 16–18; leave testimonials unchanged.
**Architecture:** Preserve Next.js/Drizzle/account studio. Fix service lifecycle and distinguish unavailable from anonymous; add recoverable reads, local optional drafts and clear workflow actions. Use existing record name columns and server pagination without a schema migration.
**Tech Stack:** Next.js, React, TypeScript, PostgreSQL, Vitest.
**Spec:** ../../../../../TattooVis_网站测试与优化评审_2026-11-02.md (approved by user in chat, except item 15).

## Constraints
- No testimonial content edits. No package additions. No price changes.
- No automatic retries for mutations/paid requests. Do not log secrets or photo/prompt payloads.
- Production root cause remains unproven until logs establish it; separate code evidence from production verification.
- User has approved implementation; proceed without repeating approval questions. Work in current clean checkout, preserving unrelated work.

## Review Focus
- Slow or failed account lookup must never trigger an anonymous redirect.
- Aborted/retried reads must stop promptly; submissions run once.
- Draft storage is explicit, local, browser-scoped (one visibly replaceable draft), bounded in retention, and clearable; login handoffs remain token-scoped.
- Pagination/search and rename must enforce ownership, including records after position 500.
- Local dates must hydrate safely and use viewer timezone; policy language must retain meaning.

## Tasks
1. [x] Stability (01–03): reproduce Node pool lifecycle regression, implement reuse/cleanup, privacy-safe diagnostics and settings error boundary; separate anonymous/library unavailable. Tests: database lifecycle, library failures, existing auth tests.
2. [x] Studio access/read recovery (02,04): failing tests for temporary GET retry/nonretrying POST and unknown capability gate; implement bounded abortable read retry + asset retry/retry UI + account refresh. Tests: studio-client and studio access/editor regressions.
3. [x] Content (05,07,09,14,17): align terms, bilingual policies and credit units; independent middle plan name, workflow cost examples; copy/use prompt action and consume prompt safely. Tests: existing pricing/policy/article coverage and typecheck.
4. [x] Libraries (06,10,13,16): local-time client component; descriptive defaults/rename; explicit cancellable delete; server search/source/pagination and exact record lookup. Tests: validation, ownership, pagination, UI.
5. [x] Studio usability (08,11,12,18): phase-specific progress and elapsed time/history link; mobile fixed action; explicit local draft save/restore/discard and leave warning; upload-time privacy notice. Tests: phase labels, draft and access regressions; browser checks at 390px and desktop.
6. [ ] Verify: focused tests, full suite, typecheck, lint, production build; independent review then resolve material findings. Record deployed vs local status honestly.

## Execution notes
Independent content/library/stability tasks delegated per dispatching-parallel-agents skill with disjoint file ownership; primary agent implements studio and integrates. Baseline npm test started before edits. Final delivery must identify any items awaiting deployment/runtime confirmation.

Final review: independent reviewer found operation errors cleared by balance refresh (fixed, RED/GREEN test), Back navigation not guarded (fixed, browser cancel confirmed), and tab-scoped plan mismatch (ruling: one explicit browser draft documented in UI/hand-off; user spec does not require per-tab drafts). Full suite 284/284, lint 0 new errors, typecheck passes. Production confirmation unavailable because deployment CLI is unauthenticated.
