import { createHmac, timingSafeEqual } from 'node:crypto';

export type LabRegion = { x: number; y: number; width: number; height: number };
const mediaHosts = [
  'tempfile.redpandaai.co',
  'tempfile.aiquickdraw.com',
  'static.aiquickdraw.com',
];
export function labEnvironment() {
  return (
    process.env.VERCEL_ENV !== 'production' &&
    (process.env.NODE_ENV !== 'production' ||
      process.env.VERCEL_ENV === 'preview')
  );
}
export function labAvailable() {
  return (
    labEnvironment() &&
    !!process.env.KIE_LAB_API_KEY &&
    (process.env.KIE_LAB_ACCESS_TOKEN?.length ?? 0) >= 24
  );
}
export function authorizeLab(req: Request) {
  if (!labAvailable()) return false;
  const actual = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${process.env.KIE_LAB_ACCESS_TOKEN}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function sign(payload: Record<string, unknown>) {
  const value = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', process.env.KIE_LAB_ACCESS_TOKEN || '')
    .update(value)
    .digest('base64url');
  return `${value}.${signature}`;
}
function read(token: string, kind: string): any {
  const [value, signature, extra] = token.split('.');
  if (!value || !signature || extra) throw new Error('Invalid test reference');
  const expected = createHmac('sha256', process.env.KIE_LAB_ACCESS_TOKEN || '')
    .update(value)
    .digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    throw new Error('Invalid test reference');
  const data = JSON.parse(Buffer.from(value, 'base64url').toString());
  if (
    data.kind !== kind ||
    !Number.isFinite(data.expiresAt) ||
    data.expiresAt < Date.now()
  )
    throw new Error('Test reference expired');
  return data;
}
function trustedMedia(url: string) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !mediaHosts.includes(parsed.hostname)
  )
    throw new Error('Untrusted test image source');
  return parsed.href;
}
export function signLabAsset(
  url: string,
  expiresAt = Date.now() + 24 * 60 * 60 * 1000
) {
  return sign({ kind: 'asset', url: trustedMedia(url), expiresAt });
}
export function readLabAsset(token: string): string {
  return trustedMedia(read(token, 'asset').url);
}
export function signLabTask(taskId: string) {
  return sign({
    kind: 'task',
    taskId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });
}
export function readLabTask(token: string): string {
  const id = read(token, 'task').taskId;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,180}$/.test(id))
    throw new Error('Invalid test task');
  return id;
}
export function buildPlacementPrompt(region: LabRegion) {
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  return `Create a realistic tattoo try-on in the FIRST reference photo. The SECOND reference is the tattoo design. The THIRD reference is a flat placement guide showing the exact intended location, size and rotation. Transfer only the tattoo ink into the indicated skin area, matching the skin lighting, texture and body curvature. Preserve the first photo's original camera angle, pose, face, clothing, background, framing and aspect ratio. Do not invent unseen body parts or change the viewpoint. Do not add tattoos elsewhere. The selected region starts at x=${percent(region.x)}, y=${percent(region.y)} from the photo's top-left, with width=${percent(region.width)} and height=${percent(region.height)}. The white background around the design is not part of the tattoo. Remove any guide markings. Return exactly one image.`;
}
export async function kieLabRequest(path: string, body?: unknown) {
  const response = await fetch(`https://api.kie.ai/api/v1/jobs/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${process.env.KIE_LAB_API_KEY}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json();
  if (!response.ok || json.code !== 200 || !json.data)
    throw new Error(
      'KIE test request was not confirmed. Check KIE logs before submitting again.'
    );
  return json.data;
}
