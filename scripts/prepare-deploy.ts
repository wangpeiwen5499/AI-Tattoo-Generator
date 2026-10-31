import { config as loadEnv } from 'dotenv';
import { inArray } from 'drizzle-orm';

import { missingDeploymentSettings } from './lib/deploy-prerequisites';

loadEnv({ path: ['.env.local', '.env.development', '.env'], quiet: true });

async function main() {
  if (process.env.VERCEL_ENV !== 'production') {
    console.log(
      'Production database preparation skipped for this environment.'
    );
    return;
  }
  if (!process.env.DATABASE_URL)
    throw new Error('Missing production setting: DATABASE_URL');
  const { db } = await import('../src/core/db');
  const { config } = await import('../src/config/db/schema');
  // Read directly: Next.js cache helpers are unavailable in a build preparation script.
  const rows = await db()
    .select()
    .from(config)
    .where(
      inArray(config.name, [
        'email_auth_enabled',
        'resend_api_key',
        'resend_sender_email',
      ])
    );
  const settings = Object.fromEntries(
    rows.map((row: any) => [row.name, row.value || ''])
  );
  const missing = missingDeploymentSettings(process.env, settings);
  if (missing.length)
    throw new Error('Missing production settings: ' + missing.join(', '));
  const { buildTattooJobsUpgrade, applyTattooJobsUpgrade } =
    await import('./lib/tattoo-jobs-upgrade');
  const result = await applyTattooJobsUpgrade(
    db(),
    await buildTattooJobsUpgrade(),
    process.env.DB_SCHEMA || 'public'
  );
  const { applyPaymentRefundsUpgrade } =
    await import('./lib/payment-refunds-upgrade');
  const refunds = await applyPaymentRefundsUpgrade(
    db(),
    process.env.DB_SCHEMA || 'public'
  );
  const { applyTattooResolutionsUpgrade } =
    await import('./lib/tattoo-resolutions-upgrade');
  console.log(
    await applyTattooResolutionsUpgrade(db(), process.env.DB_SCHEMA || 'public')
  );
  console.log('Production prerequisites verified. ' + result + '. ' + refunds);
  const { applyTattooBackgroundUpgrade } =
    await import('./lib/tattoo-background-upgrade');
  console.log(
    await applyTattooBackgroundUpgrade(db(), process.env.DB_SCHEMA || 'public')
  );
  if (!process.env.CRON_SECRET)
    console.warn(
      'CRON_SECRET is not configured. Background task advancement still requires scheduler setup; active browser polling continues to advance jobs.'
    );
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    // Do not print database URLs, queries, or credentials into deployment logs.
    const message =
      error instanceof Error && error.message.startsWith('Missing production')
        ? error.message
        : 'Production preparation failed. Verify database connectivity and migration permissions.';
    console.error(message);
    process.exit(1);
  });
