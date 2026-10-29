import { NextRequest } from 'next/server';
import { readBoundedBody, trustedFileUrl } from '@/server/storage/file-proxy';
import { isAllowedImageType } from '@/server/storage/upload-policy';

export async function GET(req: NextRequest) {
  const url = trustedFileUrl(req.nextUrl.searchParams.get('url') || '');
  if (!url)
    return Response.json({ error: 'Untrusted file URL' }, { status: 400 });
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      return Response.json({ error: 'File unavailable' }, { status: 502 });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!isAllowedImageType(type))
      return Response.json({ error: 'Unsupported image' }, { status: 415 });
    const bytes = await readBoundedBody(response, 15 * 1024 * 1024);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': type,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return Response.json({ error: 'File unavailable' }, { status: 502 });
  }
}
