# Registration trial funnel

Approved user flow: anonymous visitors explore the site's actual saved case; new accounts receive 3 credits once; signed-in verified users generate with their own photos; zero-balance users retain results and are invited to Pricing.

Implementation decisions:

- Require authenticated, email-verified identity for new uploads and paid AI work. Enforce in API routes and the transactional tattoo service. Old guest cookies do not authorize new work. Retain read-only access to already generated guest results.
- Create a fixed, non-expiring 3-credit signup grant once per new account. Serialize by user and use deterministic unique transaction number; detect pre-existing signup/gift grants to prevent duplicate legacy rewards. Auth adapter inserts the user and gift atomically; gift-write failure rolls back the user and permits retry. Gift is created at registration but cannot be spent before email verification.
- Add the Better Auth OTP client, an EN/ZH verification page with resend cooldown, and automatic signup verification email. Existing unverified accounts can log in and verify; do not re-award their signup grant. Fix callback preservation and validate local return URLs.
- Rate-limit auth traffic and cap account creations per IP at 10/day using existing guest_free_usage rows in a signup namespace; no new schema changes. Mail credentials are required for email signup; report unavailable mail service clearly.
- Guest /generate shows the real interactive example and signup/login CTAs. Mount personal-upload/generation hooks only after authenticated verification.
- Update homepage, case, signup, generate, FAQ and pricing copy in EN/ZH. One credit still covers one four-placement generation; existing failure/refund policy and package prices stay unchanged.
- Preserve the last result at zero credits, show a purchase CTA and direct the next generation action to localized Pricing; no automatic redirect on completion.

Tasks:

- [x] Regression tests: guests blocked before storage/AI calls, unverified users blocked, service-level guest rejection, single signup grant and persistent signup quota.
- [x] Implement backend access, signup reward and OTP integration with local isolated tests.
- [x] Implement guest/verification/zero-credit UI states and localized copy, callback continuity.
- [x] Verify OTP flow with simulated mail and isolated database; UI tests and browser checks; full tests, typecheck, lint, production build and independent review.

Constraints: no production data access, no real mail/AI/payment calls, no deployment. Production mail configuration and the existing tattoo_job migration/scheduler remain deployment prerequisites.
