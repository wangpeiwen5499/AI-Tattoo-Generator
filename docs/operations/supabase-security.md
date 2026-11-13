# Server-only database security

TattooVis uses Better Auth and server-side postgres-js/Drizzle, not Supabase Auth JWTs or browser Data API calls. Business tables have RLS enabled with no public policies. This is intentional default denial; do not silence INFO notices with permissive policies. The server currently connects as postgres through Supavisor, observed while exercising authenticated production requests on 2026-11-13. postgres has BYPASSRLS; server routes must continue enforcing ownership and authorization.

## Applied remediation, 2026-11-13

Supabase migration `harden_public_business_access` enabled RLS on 24 previously unprotected tables and preserved protection on guest_free_usage. It revoked table rights from PUBLIC/anon/authenticated; inspected column ACLs and sequences were absent. Four inspected invoker functions lost public execution and received a fixed pg_catalog,public search_path. No data, sessions, function bodies, ownership or credentials were changed.

The postgres creator's public-schema default table/sequence/function grants to API roles were revoked. PostgreSQL's global PUBLIC default EXECUTE for newly created postgres-owned functions was also revoked: schema-local revocation cannot override a global grant. Existing managed-schema objects are unchanged. supabase_admin default ACLs cannot be edited by postgres (not a member); do not attempt privilege escalation. New app objects must be created by the configured migration role and pass deployment verification.

The local pre-change object/default ACL and function-definition snapshot is saved under ignored `.vercel/security-before-20261113.json`. It contains metadata, not a full data backup. A managed backup/recovery inventory remains a separate dashboard check. Recovery should restore only a legitimate server role's necessary permissions, never anonymous broad access.

## Regression prevention

- The shared Drizzle table factory enables RLS for every new application table.
- Raw studio table installation enables RLS within its existing transaction.
- Production prepare verifies application-schema tables, views, sequences, column privileges and functions; unsafe RLS or effective API-role grants fail deployment.
- Metadata verification and schema generation are exercised against disposable PGlite, including accidental grants and public function execution. No paid production generation is needed for this change.
- Existing migration files under supabase/migrations are tracked; apply them to a new hosted environment as part of provisioning. Supabase CLI and Drizzle use separate migration journals: do not assume executing one runs the other.

## Verification and limitations

Immediately after applying the migration: all 25 public tables had RLS, anon/authenticated had no effective table/column privileges, all four functions denied execution to both roles, and Security Advisor reported no ERROR or WARN (only 25 expected RLS-with-no-policy INFO findings). Six no-row REST probes using the project publishable key returned 401 / SQLSTATE 42501.

Authenticated production session, studio status, credits, /history and /designs returned 200. Collection APIs returned the owner's existing records. No generation, spending, deletion, all-user logout or key rotation was performed. One large asset GET returned image/png 200 headers but timed out reading its body; this alone does not establish a permission regression or a successful complete download.

Data API disablement is additional defense. The existing API permissions are already closed independently. Dashboard browser connection timed out twice after user login, so user was handed the exact Data API settings page to disable the switch manually; confirm its outcome before claiming the project-wide API is disabled. Logs reviewed in analysis cannot establish whether historical disclosure occurred.

Fresh isolated browser sign-in after remediation succeeded and returned authenticated studio status 200. The existing history page loaded all 18 record thumbnails successfully in the browser, despite request-client full-download timeouts. Full suite: 76 files / 318 tests passed; typecheck passed; lint reported 0 new errors (59 existing template errors / 43 warnings). The focused suite also passed after adding accidental-public-function regression coverage.
