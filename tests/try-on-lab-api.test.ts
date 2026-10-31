import { GET, POST } from '@/app/api/preview/try-on/route';
import { signLabAsset } from '@/server/ai/try-on-lab';
import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/shared/lib/rate-limit', () => ({
  enforceMinIntervalRateLimit: () => null,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function configure() {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('KIE_LAB_API_KEY', 'test-only');
  vi.stubEnv('KIE_LAB_ACCESS_TOKEN', 'a'.repeat(32));
  vi.stubGlobal('fetch', mocks.fetch);
}
it('production denies every lab operation without calling a provider', async () => {
  configure();
  vi.stubEnv('VERCEL_ENV', 'production');
  expect(
    (await GET(new Request('https://local/api/preview/try-on'))).status
  ).toBe(404);
  expect(
    (
      await POST(
        new Request('https://local/api/preview/try-on?mode=render', {
          method: 'POST',
          body: '{}',
        })
      )
    ).status
  ).toBe(404);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('rejects unauthenticated preview generation before parsing or uploading', async () => {
  configure();
  const response = await POST(
    new Request('https://local/api/preview/try-on?mode=render', {
      method: 'POST',
      body: '{}',
    })
  );
  expect(response.status).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('submits exactly one single-placement call with auto framing and signed references', async () => {
  configure();
  mocks.fetch.mockResolvedValue(
    Response.json({ code: 200, data: { taskId: 'lab-test-task' } })
  );
  const asset = signLabAsset('https://tempfile.redpandaai.co/lab/image.png');
  const response = await POST(
    new Request('https://local/api/preview/try-on?mode=render', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${'a'.repeat(32)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        photo: asset,
        design: asset,
        guide: asset,
        region: { x: 0.2, y: 0.2, width: 0.3, height: 0.4 },
      }),
    })
  );
  expect(response.status).toBe(200);
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  const sent = JSON.parse(mocks.fetch.mock.calls[0][1].body);
  expect(sent.input).toMatchObject({ aspect_ratio: 'auto', resolution: '1K' });
  expect(sent.input.input_urls).toHaveLength(3);
  expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe(
    'Bearer test-only'
  );
});
it('rejects out-of-bounds placement before any billable call', async () => {
  configure();
  const asset = signLabAsset('https://tempfile.redpandaai.co/lab/image.png');
  const response = await POST(
    new Request('https://local/api/preview/try-on?mode=render', {
      method: 'POST',
      headers: { authorization: `Bearer ${'a'.repeat(32)}` },
      body: JSON.stringify({
        photo: asset,
        design: asset,
        guide: asset,
        region: { x: 0.8, y: 0.2, width: 0.4, height: 0.4 },
      }),
    })
  );
  expect(response.status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it.each(['2K', '4K'])(
  'submits the explicitly selected %s single-render resolution',
  async (resolution) => {
    configure();
    mocks.fetch.mockResolvedValue(
      Response.json({ code: 200, data: { taskId: 'lab-hd-task' } })
    );
    const asset = signLabAsset('https://tempfile.redpandaai.co/lab/image.png');
    const response = await POST(
      new Request('https://local/api/preview/try-on?mode=render', {
        method: 'POST',
        headers: { authorization: `Bearer ${'a'.repeat(32)}` },
        body: JSON.stringify({
          photo: asset,
          design: asset,
          guide: asset,
          resolution,
          region: { x: 0.2, y: 0.2, width: 0.3, height: 0.4 },
        }),
      })
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).input.resolution).toBe(
      resolution
    );
  }
);

it('reports missing preview configuration names without exposing values', async () => {
  configure();
  vi.stubEnv('KIE_LAB_ACCESS_TOKEN', 'too-short-test-value');
  const response = await GET(new Request('https://local/api/preview/try-on'));
  const data = await response.json();
  expect(data.configured).toBe(false);
  expect(data.missing).toEqual(['KIE_LAB_ACCESS_TOKEN（至少 24 个字符）']);
  expect(JSON.stringify(data)).not.toContain('too-short-test-value');
  expect(JSON.stringify(data)).not.toContain('test-only');
});
