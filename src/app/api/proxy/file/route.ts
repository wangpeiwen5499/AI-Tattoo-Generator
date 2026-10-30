import { NextRequest } from 'next/server';
import { MAX_GENERATED_IMAGE_BYTES } from '@/lib/tattoo-resolution';
import { trustedFileUrl } from '@/server/storage/file-proxy';
import { isAllowedImageType } from '@/server/storage/upload-policy';

export async function GET(req: NextRequest) {
  const url = trustedFileUrl(req.nextUrl.searchParams.get('url') || '');
  if (!url)
    return Response.json({ error: 'Untrusted file URL' }, { status: 400 });
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok)
      return Response.json({ error: 'File unavailable' }, { status: 502 });
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!isAllowedImageType(type))
      return Response.json({ error: 'Unsupported image' }, { status: 415 });
    if (
      Number(response.headers.get('content-length')) >
        MAX_GENERATED_IMAGE_BYTES ||
      !response.body
    ) {
      await response.body?.cancel();
      return Response.json({ error: 'File unavailable' }, { status: 502 });
    }
    let total = 0;
    // Streaming avoids Vercel's buffered-response limit for high resolution PNGs.
    const stream = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          total += chunk.byteLength;
          if (total > MAX_GENERATED_IMAGE_BYTES)
            throw new Error('File too large');
          controller.enqueue(chunk);
        },
      })
    );
    return new Response(stream, {
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
