# Single-placement Preview validation

Scope approved: local photos, selected target area, reusable tattoo design, free drag/scale/rotate preview, one realistic rendering. Validation only; no billing changes. User explicitly requires Vercel Preview, no production changes.

Implementation: independent static /try-on-lab/index.html + browser canvas; no production app routes, database, credits, orders, R2 or Workflow modifications. A Preview-only API uses separate KIE_LAB_API_KEY and KIE_LAB_ACCESS_TOKEN. Missing configuration disables real generation. No fallback to production credentials. No billable automatic retries. Uploaded photos stay local until explicit KIE action and disclosure.

Validation: desktop/mobile region selection, normalized original-photo coordinates, design reuse and instant controls, original-versus-draft distinction. Optional KIE text-to-image design and one image-to-image call using photo + design + placement guide. Compare raw model output with a version composited inside the selected area. Native masked editing is not claimed. Preserve the original aspect ratio; never generate unseen body parts.

Production safety: branch feat/single-placement-preview only. Push this branch for Preview; never push shipany-two or main. Existing production scheduler/billing untouched. Deploy preparation already skips non-production migrations.

Design: a photo work surface dominates; compact controls on the right, stacked on mobile. Existing violet accent with white/slate surfaces, no ornamental cards or floating toolbar. Clearly distinguish free placement preview, raw AI output and selected-area composition. The lab defaults to 1K to validate placement before spending on higher resolution.

Done when: interactive Preview URL is available, geometry/API gate tests pass, build succeeds, and actual KIE validation is either evidenced by a paid test explicitly requested in the UI or clearly reported pending credentials/input. Never invent successful AI output.
