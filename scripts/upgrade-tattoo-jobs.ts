import { config } from 'dotenv';

config({ path: ['.env.local', '.env.development', '.env'], quiet: true });

async function main() {
  const {
    buildTattooJobsUpgrade,
    applyTattooJobsUpgrade,
    uploadBudgetUpgrade,
  } = await import('./lib/tattoo-jobs-upgrade');
  const { envConfigs } = await import('../src/config');
  const statements = await buildTattooJobsUpgrade();
  if (!process.argv.includes('--apply')) {
    console.log(
      'Preview only. Creates tattoo_job and adds an upload_count column. Existing records are preserved.'
    );
    console.log(statements.join(';\n'));
    console.log(uploadBudgetUpgrade(envConfigs.db_schema) + ';');
    console.log(
      '\nTo apply to your configured DATABASE_URL: npm run db:upgrade:tattoo-jobs -- --apply'
    );
    return;
  }
  const { db } = await import('../src/core/db');
  const result = await applyTattooJobsUpgrade(
    db(),
    statements,
    envConfigs.db_schema
  );
  console.log(result);
  // Script owns its process; avoid keeping transient postgres pools alive.
  process.exit(0);
}
main().catch((error) => {
  console.error(
    'Database upgrade failed:',
    error instanceof Error ? error.message : 'Unknown error'
  );
  process.exit(1);
});
