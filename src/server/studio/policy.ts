import {
  IMAGE_SAFETY_ERROR,
  isProhibitedImagePrompt,
  TATTOO_RENDER_SAFETY,
} from '@/server/ai/image-safety';
import { z } from 'zod';

export class StudioError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/**
 * Account studio access requires either the production deployment or a
 * Preview deployment whose owner has certified — by setting
 * PREVIEW_STUDIO_ISOLATED=1 — that the attached DATABASE_URL, R2 bucket and
 * KIE_API_KEY point at isolated Preview resources, never production data.
 * Without the flag every account surface stays explicitly unavailable instead
 * of silently falling back to browser-local storage or simulated credits.
 */
export function previewStudioIsolated() {
  return process.env.PREVIEW_STUDIO_ISOLATED === '1';
}
export function accountStudioAllowed() {
  return (
    process.env.VERCEL_ENV === 'production' ||
    (process.env.VERCEL_ENV === 'preview' && previewStudioIsolated())
  );
}
export function assertAccountStudio() {
  if (!accountStudioAllowed())
    throw new StudioError(
      'The account studio is not enabled in this environment.',
      503
    );
}
export async function studioConfigured() {
  if (!accountStudioAllowed()) return false;
  const { getAllConfigs } = await import('@/shared/models/config');
  const configs = await getAllConfigs();
  return (
    !!(process.env.KIE_API_KEY || configs.kie_api_key) &&
    [
      'DATABASE_URL',
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_PUBLIC_URL',
    ].every((key) => !!process.env[key])
  );
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    throw new StudioError('Invalid request origin', 403);
}
const uuid = z.string().uuid();
const base = z.object({
  operationId: uuid,
  prompt: z.string().trim().min(1).max(1000),
});
const region = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .refine((v) => v.x + v.width <= 1.001 && v.y + v.height <= 1.001);
const render = z.object({
  operationId: uuid,
  photo: uuid,
  design: uuid,
  guide: uuid,
  region,
  resolution: z.enum(['1K', '2K', '4K']),
  prompt: z.string().trim().max(1000).optional(),
  designId: uuid.optional(),
  placement: z
    .object({
      px: z.number().min(0).max(1),
      py: z.number().min(0).max(1),
      scale: z.number().min(0.1).max(4),
      rotation: z.number().min(0).max(360),
      opacity: z.number().min(0.05).max(1),
      flipped: z.boolean(),
    })
    .optional(),
});
export function validateStudioInput(kind: 'design' | 'render', raw: unknown) {
  const parsed = (kind === 'design' ? base : render).safeParse(raw);
  if (!parsed.success) throw new StudioError('Invalid studio request');
  const input = parsed.data;
  if (input.prompt && isProhibitedImagePrompt(input.prompt))
    throw new StudioError(IMAGE_SAFETY_ERROR);
  const resolution = 'resolution' in input ? input.resolution : '1K';
  return {
    input,
    resolution,
    credits: resolution === '4K' ? 3 : resolution === '2K' ? 2 : 1,
  };
}
export function placementPrompt(region: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return `${TATTOO_RENDER_SAFETY} Apply the SECOND reference tattoo design to the FIRST original photo using the THIRD flat placement guide for exact position, size and rotation. Match skin texture, perspective and lighting. Preserve pose, face, clothing, background, framing and aspect ratio. Remove design white background and guide marks. Add no other tattoos. Region normalized from top-left: ${JSON.stringify(region)}. Return exactly one image.`;
}
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
