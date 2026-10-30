import { NextRequest } from 'next/server';
import { GET } from '@/app/api/proxy/file/route';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('streams a high resolution download before its upstream body finishes', async () => {
  process.env.R2_PUBLIC_URL = 'https://files.example.com';
  let upstream!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      upstream = controller;
    },
  });
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(body, { headers: { 'content-type': 'image/png' } })
      )
  );
  const pending = GET(
    new NextRequest(
      'https://local/api/proxy/file?url=https://files.example.com/large.png'
    )
  );
  const early = await Promise.race([
    pending,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 30)),
  ]);
  upstream.enqueue(new Uint8Array(5 * 1024 * 1024));
  upstream.close();
  const response = await pending;
  expect(early).not.toBeNull();
  expect(response.status).toBe(200);
  expect((await response.arrayBuffer()).byteLength).toBe(5 * 1024 * 1024);
});

it('rejects a declared oversized file before starting the response', async () => {
  process.env.R2_PUBLIC_URL = 'https://files.example.com';
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response('x', {
          headers: {
            'content-type': 'image/png',
            'content-length': String(81 * 1024 * 1024),
          },
        })
      )
  );
  const response = await GET(
    new NextRequest(
      'https://local/api/proxy/file?url=https://files.example.com/large.png'
    )
  );
  expect(response.status).toBe(502);
});
