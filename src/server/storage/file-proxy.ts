import { isIP } from 'node:net';

export function trustedFileUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    const origins = [
      process.env.R2_PUBLIC_URL,
      ...(process.env.FILE_PROXY_ORIGINS || '').split(','),
    ]
      .filter(Boolean)
      .map((value) => new URL(value!).origin);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      isIP(url.hostname) ||
      url.hostname === 'localhost'
    )
      return null;
    return origins.includes(url.origin) ? url : null;
  } catch {
    return null;
  }
}

export async function readBoundedBody(
  response: Pick<Response, 'headers' | 'body'>,
  maxBytes: number
): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes) throw new Error('File too large');
  if (!response.body) throw new Error('Empty file');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) throw new Error('File too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks, total);
}
