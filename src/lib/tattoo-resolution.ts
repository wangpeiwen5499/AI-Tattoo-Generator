export const TATTOO_RESOLUTIONS = ['1K', '2K', '4K'] as const;
export type TattooResolution = (typeof TATTOO_RESOLUTIONS)[number];
export const DEFAULT_TATTOO_RESOLUTION: TattooResolution = '1K';
export const MAX_GENERATED_IMAGE_BYTES = 80 * 1024 * 1024;
const POLICY = {
  '1K': {
    credits: 1,
    maxImageBytes: 15 * 1024 * 1024,
    timeoutMs: 20 * 60 * 1000,
  },
  '2K': {
    credits: 2,
    maxImageBytes: 40 * 1024 * 1024,
    timeoutMs: 30 * 60 * 1000,
  },
  '4K': {
    credits: 3,
    maxImageBytes: MAX_GENERATED_IMAGE_BYTES,
    timeoutMs: 45 * 60 * 1000,
  },
} as const;
export function parseTattooResolution(value: unknown): TattooResolution {
  if (value === undefined) return DEFAULT_TATTOO_RESOLUTION;
  if (
    typeof value !== 'string' ||
    !TATTOO_RESOLUTIONS.includes(value as TattooResolution)
  )
    throw new Error('Unsupported image resolution');
  return value as TattooResolution;
}
export function tattooResolutionPolicy(
  value: unknown = DEFAULT_TATTOO_RESOLUTION
) {
  return POLICY[parseTattooResolution(value)];
}
