import { randomUUID } from 'node:crypto';
import {
  authorizeLab,
  buildPlacementPrompt,
  kieLabRequest,
  labAvailable,
  labEnvironment,
  readLabAsset,
  readLabTask,
  signLabAsset,
  signLabTask,
} from '@/server/ai/try-on-lab';
import { hasImageSignature } from '@/server/storage/upload-policy';
import { z } from 'zod';

import { enforceMinIntervalRateLimit } from '@/shared/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;
const regionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0.015).max(1),
    height: z.number().min(0.015).max(1),
  })
  .refine((r) => r.x + r.width <= 1.001 && r.y + r.height <= 1.001);
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
export async function GET(req: Request) {
  if (!labEnvironment()) return json({ error: 'Not found' }, 404);
  const asset = new URL(req.url).searchParams.get('asset');
  if (!asset) return json({ configured: labAvailable(), resolution: '1K' });
  if (!authorizeLab(req)) return json({ error: 'Test access required' }, 403);
  try {
    const response = await fetch(readLabAsset(asset), {
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
    });
    const type = response.headers.get('content-type')?.split(';')[0] || '';
    if (
      !response.ok ||
      !response.body ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(type) ||
      Number(response.headers.get('content-length')) > 20 * 1024 * 1024
    )
      return json({ error: 'Test image unavailable' }, 502);
    let total = 0;
    return new Response(
      response.body.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            total += chunk.byteLength;
            if (total > 20 * 1024 * 1024) throw new Error('Image too large');
            controller.enqueue(chunk);
          },
        })
      ),
      {
        headers: {
          'Content-Type': type,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    );
  } catch {
    return json({ error: 'Test image unavailable' }, 400);
  }
}
export async function POST(req: Request) {
  if (!labEnvironment()) return json({ error: 'Not found' }, 404);
  if (!authorizeLab(req))
    return json(
      {
        error:
          'Configure the Preview-only KIE_LAB_API_KEY and KIE_LAB_ACCESS_TOKEN, then enter the test access token.',
      },
      403
    );
  const mode = new URL(req.url).searchParams.get('mode');
  if (mode === 'design' || mode === 'render') {
    const limited = enforceMinIntervalRateLimit(req, {
      intervalMs: 1500,
      keyPrefix: 'try-on-lab',
      extraKey: 'preview',
    });
    if (limited) return limited;
  }
  try {
    if (mode === 'upload') {
      const form = await req.formData();
      const file = form.get('image');
      if (
        !(file instanceof File) ||
        file.size <= 0 ||
        file.size > 3 * 1024 * 1024 ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      )
        return json(
          { error: 'Test images must be PNG, JPEG or WebP under 3 MB.' },
          400
        );
      if (
        !hasImageSignature(
          new Uint8Array(await file.slice(0, 12).arrayBuffer()),
          file.type
        )
      )
        return json({ error: 'Invalid image content' }, 400);
      const upload = new FormData();
      upload.set('file', file);
      upload.set('uploadPath', `tattoovis-preview/${randomUUID()}`);
      upload.set(
        'fileName',
        `${randomUUID()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`
      );
      const response = await fetch(
        'https://kieai.redpandaai.co/api/file-stream-upload',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${process.env.KIE_LAB_API_KEY}` },
          body: upload,
          signal: AbortSignal.timeout(30_000),
        }
      );
      const result = await response.json();
      if (!response.ok || result.code !== 200 || !result.data?.downloadUrl)
        throw new Error('KIE test upload failed');
      return json({ asset: signLabAsset(result.data.downloadUrl) });
    }
    const data = await req.json();
    if (mode === 'status') {
      const parsed = z.object({ task: z.string().max(3000) }).parse(data);
      const result = await kieLabRequest(
        `recordInfo?taskId=${encodeURIComponent(readLabTask(parsed.task))}`
      );
      if (result.state === 'success') {
        const urls = JSON.parse(result.resultJson || '{}').resultUrls;
        if (!Array.isArray(urls) || typeof urls[0] !== 'string')
          throw new Error('KIE returned no image');
        return json({ state: 'success', asset: signLabAsset(urls[0]) });
      }
      return json({
        state: result.state,
        failed: ['fail', 'failed'].includes(result.state),
      });
    }
    if (mode === 'design') {
      const parsed = z
        .object({ prompt: z.string().trim().min(3).max(500) })
        .parse(data);
      const result = await kieLabRequest('createTask', {
        model: 'gpt-image-2-text-to-image',
        input: {
          prompt: `${parsed.prompt}. A single tattoo flash design, centered on pure white background, no skin, no lettering unless requested.`,
          aspect_ratio: '1:1',
          resolution: '1K',
        },
      });
      return json({ task: signLabTask(result.taskId) });
    }
    if (mode === 'render') {
      const parsed = z
        .object({
          photo: z.string(),
          design: z.string(),
          guide: z.string(),
          region: regionSchema,
        })
        .parse(data);
      const result = await kieLabRequest('createTask', {
        model: 'gpt-image-2-image-to-image',
        input: {
          prompt: buildPlacementPrompt(parsed.region),
          input_urls: [
            readLabAsset(parsed.photo),
            readLabAsset(parsed.design),
            readLabAsset(parsed.guide),
          ],
          aspect_ratio: 'auto',
          resolution: '1K',
        },
      });
      return json({ task: signLabTask(result.taskId) });
    }
    return json({ error: 'Unsupported test operation' }, 400);
  } catch (error) {
    if (error instanceof z.ZodError)
      return json({ error: 'Invalid test input' }, 400);
    console.error('[try-on-lab] request failed');
    return json(
      { error: error instanceof Error ? error.message : 'Test request failed' },
      502
    );
  }
}
