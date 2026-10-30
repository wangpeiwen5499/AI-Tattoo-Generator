# Account usability implementation plan

**Goal:** Compact footer, password recovery, signup confirmation, removal of user API Keys, and Google sign-in through Clerk.

**Architecture:** Retain Better Auth sessions and existing user IDs, credits, and purchase history. Add Clerk as an OIDC provider using the installed Generic OAuth plugin, with PKCE and verified email claims. Keep email/password access. Configure Clerk credentials on the server; expose only a derived availability flag. No data migration or new signup gifts for existing users.

**Tech stack:** Next.js 16, Better Auth 1.6.26, Clerk OIDC, Resend, Vitest/PGlite.

## Tasks

- [x] Compact `src/themes/default/blocks/footer.tsx`: narrower content, smaller logo and gaps, one bottom row. Check desktop/mobile EN/ZH in browser.
- [x] Add localized confirmation input to signup. Test mismatch prevents registration.
- [x] Add localized forgot/reset pages and links from both sign-in forms. Use Better Auth reset tokens, existing mail provider, expiry, replay protection, and session revocation. Test actual auth flow with mocked delivery, unchanged credits, unknown emails, and token replay.
- [x] Remove API Keys from both user settings menus and make all user API Keys routes return 404. Preserve database records.
- [x] Add Clerk OIDC config, conditional Google button and safe callback handling. Test authorization state/PKCE, callback, verified identity, existing account linking, and one-time gifts. Document Clerk Google connection and OAuth app setup. Requires the user's Clerk project credentials before activation.
- [x] Run all tests, typecheck, baseline lint, build; inspect UI; push production branch using existing GitHub auto-deployment authorization. Report actual availability of Clerk separately from code completion.

Validation: 73 tests passed; typecheck and production build passed; baseline lint reports zero new errors. EN/ZH mobile forms and desktop/mobile footer inspected. Clerk configuration and live OAuth authorization remain user-owned; see docs/operations/clerk-google-login.md.
