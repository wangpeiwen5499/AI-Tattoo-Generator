# Native Clerk Google login

Goal: clicking Google starts Google's account picker through Clerk (`oauth_google`, `prompt=select_account`), without the Clerk OAuth application's consent screen.

Retain Better Auth email/password and website sessions. Load Clerk React only in dedicated `/auth/google` routes. Complete the native Clerk flow, submit its session token in an Authorization header to a same-origin Better Auth endpoint, authenticate it with Clerk's backend SDK, and load the verified user profile from Clerk. Reuse Better Auth's OAuth account linking/session helpers with provider ID `clerk` to preserve previously linked accounts. New users retain the existing atomic, once-only three-credit gift. Require verified primary email and a linked Google identity; never accept email/profile from the browser.

- [ ] Add native config and server identity verification, retaining old OAuth callback handling only for in-flight compatibility.
- [ ] Add a guarded Better Auth bridge, preserving signup quotas, account linking, credits and cookies. Test invalid/unverified/cross-origin requests, repeated login, account linking and no duplicate gifts.
- [ ] Add dedicated native start/callback/complete/continue UI, explicit Google strategy and account selection. Preserve safe localized callbacks, handle cancellation and additional Clerk verification requirements. Replace Google button navigation and update configuration documentation.
- [ ] Verify unit/integration tests, UI, typecheck, lint, build; independent review; push the production branch and verify deployment and real Google redirect. The user has configured native Clerk publishable and secret keys in Vercel. Do not read or print the secret key.
