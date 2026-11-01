# Preview account isolation configuration

The Preview deployment now runs the real account studio (`/api/studio`) instead
of browser-local storage or simulated credits. Because a Vercel Preview
deployment inherits the project's environment variables by default, account
mode stays **off** until the owner explicitly certifies that the attached
resources are isolated. Until then every account surface shows an explicit
"not enabled in this environment" state — it never falls back to IndexedDB,
localStorage wallets or mock balances.

## Gating

`PREVIEW_STUDIO_ISOLATED=1` (Vercel → Project → Settings → Environment
Variables → add to the **Preview** environment only) is the owner's
certification that the variables below point at isolated Preview resources and
never at production. `accountStudioAllowed()` in `src/server/studio/policy.ts`
admits account operations only for `VERCEL_ENV=production` or Preview with this
flag. Without the flag: `/api/studio` returns `configured:false, reason:
"isolation"` for capability reads and rejects mutations with 503; `/studio`,
`/designs` and `/history` show the unavailable state; the sign-in entry stays
hidden.

## Required Preview environment variables (Vercel, Preview scope)

| Variable | Purpose | Notes |
| --- | --- | --- |
| `PREVIEW_STUDIO_ISOLATED` | Explicit isolation certification (`1`) | Set **last**, after everything below is verified isolated |
| `DATABASE_URL` | Isolated Postgres for accounts, sessions, credits, studio tables | Must NOT be the production Supabase URL. Empty schema is fine; migrations below create tables |
| `AUTH_SECRET` | Session signing for the Preview domain | Use a distinct value from production |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` | Isolated image storage | Separate bucket (or strictly scoped prefix with a dedicated token). Studio uploads/outputs go here |
| `KIE_API_KEY` | Generation provider key for Preview | Must be a Preview-only key with spend caps — never the production key, never `KIE_LAB_*` |
| `EMAIL_*` (provider vars used by the email sender) | Verification emails for sign-up | Test SMTP or a sandbox provider; without it sign-up verification emails cannot be delivered |
| `NEXT_PUBLIC_APP_URL` | Canonical URL of the Preview deployment | Used by SEO metadata; Preview pages stay `noindex` regardless |
| `CRON_SECRET` (optional) | Scheduler recovery path for studio jobs | Only if a Preview scheduler is wired |

Also review any other inherited production variables on the Preview scope and
remove or replace the ones that could reach production data (payment provider
keys in particular — Preview pricing never triggers checkout).

## Migration steps (owner, after the variables are set)

1. Create the isolated Postgres database (empty schema).
2. Create the isolated R2 bucket + scoped token.
3. Create the Preview-scoped KIE key with a spend cap.
4. Set all variables above in Vercel for the **Preview** environment and
   redeploy this branch.
5. Apply the schema: from a checkout of this branch with the Preview
   `DATABASE_URL` exported, run `npm run deploy:prepare` (additive,
   repeatable; it creates the auth/config/credit/studio tables). Do not run it
   against production — production already has its schema.
6. Redeploy/restart the Preview deployment, then verify in the Preview UI:
   sign-up → verification email → 3 welcome credits → studio capabilities
   report `configured: true`.

## What is explicitly NOT claimed

- No end-to-end account/billing run was executed against a live isolated
  database in this change; automated coverage uses isolated PGlite and mocked
  provider/R2 responses.
- No real purchase, refund or paid generation was performed.
- Waffo dashboard copy/covers and the Google Cloud branding app name remain
  owner-manual actions (see `docs/commerce/waffo-products.md`).
