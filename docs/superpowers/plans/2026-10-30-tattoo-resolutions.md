# Tattoo Resolution Upgrade Plan

**Approved contract:** Default 1K costs 1 credit; 2K costs 2; 4K costs 3. A task is one design plus four body placements, all at its selected resolution. Keep package prices, package credit quantities and existing balances unchanged. Retain original-grant generation compensation and full-payment-refund protections.

- [x] Add shared resolution policy/types, safe defaults, bounded image sizes and task timeouts. Tests reject unsupported values and verify 1/2/3 costs.
- [x] Persist resolution and credits_cost on tattoo_project (legacy defaults 1K/1), additive idempotent production upgrade. Start service validates immutable idempotency parameters and server-side debit; all 5 KIE calls read the saved resolution. Status/history expose saved snapshot.
- [x] Add accessible 1K/2K/4K picker and dynamic quote/balance handling. Hook sends selected resolution, restores server snapshot, keeps selection for next design, freezes active requests. Failure wording reflects reversed generation charge.
- [x] Raise bounded output storage/download support for 4K while retaining 10MB input upload limit and SSRF/signature validation. Use bounded per-resolution output limits; no unbounded downloads.
- [x] Update EN/ZH pricing, FAQ, trial and commerce copy to specify resolution costs and conditional 1K preview counts; do not alter product IDs, prices or balances. Supply updated Waffo paste-ready text, no external dashboard access assumed.
- [x] Red/green service/API/UI/recovery/migration tests, review, types/lint/full tests; push via shipany-two automatic deployment and verify its production build. No paid KIE calls without user authorization for actual test generation.

Validation before push: 149 tests passed; TypeScript passed; lint reported 0 new errors. Desktop and 390px mobile picker reviewed. Independent review findings addressed. Production build/deployment will be verified against the pushed commit.
