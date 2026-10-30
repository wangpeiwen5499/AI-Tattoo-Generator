# Direct Google Login Implementation Plan

**Goal:** Google returns directly to Better Auth, without the Clerk browser bridge.
**Architecture:** Use the installed Better Auth Google provider and server callback. Keep legacy Clerk routes for in-flight flows. Same verified email links to the existing user; the transactional adapter retains the once-only three-credit gift.
**Tech Stack:** Next.js, Better Auth 1.6.26, Drizzle/PostgreSQL.
**Spec:** User approved replacing Clerk Google with direct Google on 2026-10-30.

- [x] Test direct Google priority, safe callback, errors, and no Clerk browser preload; simplify social-providers.tsx.
- [x] Test configuration readiness and real authorization-code callback using mocked Google token exchange and the real local database/auth handler; cover PKCE, state replay, old verified Clerk users, unverified collisions, and once-only gift.
- [x] Configure provider readiness in core/auth/google.ts and public config; leave existing Clerk handlers compatible.
- [ ] Document Google callback and Vercel settings. Run full tests, types, lint, build. Push only after configuration confirmation; verify production Google request redirect_uri.

**Constraints:** No secret exposure, no user/credit/order migration, no repeated gift, no relaxing local email verification.

**Validation:** 103 tests passed, typecheck passed, baseline lint passed (0 new errors), webpack production build passed; review found no blocker. User confirmed Google Cloud and Production environment configuration before push. Production smoke pending.
