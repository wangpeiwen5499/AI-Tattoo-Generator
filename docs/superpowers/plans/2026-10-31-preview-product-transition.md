# Preview product workflow and pricing transition

**Goal:** Validate the complete two-stage tattoo product in Preview, with consistent marketing, design reuse, history and explicit per-operation credit information; never modify production balances, orders, subscriptions or legacy entitlements.

**Approved brief:** User's eight-row checklist in this conversation. Design generation: 1 credit at 1K. Single try-on: 1/2/3 credits at 1K/2K/4K. Upload, placement, saving/reusing designs free. Packs remain $4.99/5, $14.99/20 and $29.99/50. No fixed output-count promises. Full-refund unused credits only; partial refunds manual. Legacy purchased entitlements require a separate rollout decision.

**Isolation:** Preview-only server routing/copy. KIE calls retain lab key/token and explicit consent. No fallback to production key, database, R2 or credit ledger. Pending user confirmation of isolated Preview persistence resources: browser-local storage is a prototype option, not account-level saving; no real checkout or billing enablement.

## Work packages

- [x] Marketing and routing: Preview homepage hero, current interactive example context, instructions/features/FAQ, welcome credit conditions, draft pricing, guide content and navigation. Production renders current product unchanged.
- [x] Durable browser prototype: free design library with image, prompt, creation time and source; separate try-on history; reuse and deletion; quota/storage failure feedback and download fallback. Database-backed persistence only with isolated resources.
- [x] Studio integration: upload/new/saved design selection, success-only automatic save of generated designs, local history, free manipulation, visible cost/resolution selection and isolated test-credit handling. Failed/ambiguous requests do not silently consume or duplicate credits; resume is idempotent.
- [x] Lab provider API: validate 1K/2K/4K single-render settings; retain 1K design and production 404 isolation.
- [x] Waffo product descriptions, refund and email copy drafts, multilingual checks and explicit rollout checklist. Do not publish merchant changes or send email.
- [x] Regression tests, full tests/types/lint/build, desktop/mobile verification, final review and Preview deployment.

## Integration boundaries

Marketing code owns src/config/preview and src/shared/blocks/tattoo preview components plus Preview route branches. Browser library owns public/try-on-lab/library.mjs and its own tests, exporting an async adapter without UI/provider/network calls. Studio owns current static UI and API. Keep work packages independent; review interfaces before integration.

## Decisions and evidence

- Initial user question asks whether Preview has separate DB/R2. Do not write to existing production-backed resources while awaiting the answer.
- Existing saved four-placement wolf outputs are real historical examples, not a promise that every new task creates four images.

Ruling: user confirmed browser-local storage and simulated credits. Account synchronization and real financial integration remain outside this Preview rollout. Independent final review found no remaining blockers after pending-task, cross-tab and ambiguous-submit fixes.
