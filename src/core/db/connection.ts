// Vercel instances scale independently. Supabase session pooling reserves a
// backend per client; transaction pooling releases it after each transaction.
export function resolveDatabaseConnection(
  databaseUrl: string,
  vercelEnv?: string
) {
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    return { url: databaseUrl, transactionPooler: false };
  }
  const supabasePooler =
    (parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:') &&
    parsed.hostname.toLowerCase().endsWith('.pooler.supabase.com');
  if (!supabasePooler) return { url: databaseUrl, transactionPooler: false };
  const serverless = vercelEnv === 'production' || vercelEnv === 'preview';
  if (serverless && (!parsed.port || parsed.port === '5432')) {
    parsed.port = '6543';
    return { url: parsed.toString(), transactionPooler: true };
  }
  return { url: databaseUrl, transactionPooler: parsed.port === '6543' };
}
