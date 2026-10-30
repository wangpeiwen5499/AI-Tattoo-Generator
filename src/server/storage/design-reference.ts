import sharp from 'sharp';

// KIE image-to-image accepts at most 30 MB per reference image.
export const MAX_DESIGN_REFERENCE_BYTES = 30 * 1024 * 1024;

export async function prepareDesignReference(
  buffer: Buffer,
  contentType: string,
  maxBytes = MAX_DESIGN_REFERENCE_BYTES
): Promise<{ buffer: Buffer; contentType: string }> {
  if (buffer.length <= maxBytes) return { buffer, contentType };
  for (const quality of [95, 90, 85, 80]) {
    const compressed = await sharp(buffer, { limitInputPixels: 64_000_000 })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality, chromaSubsampling: '4:4:4' })
      .toBuffer();
    if (compressed.length <= maxBytes)
      return { buffer: compressed, contentType: 'image/jpeg' };
  }
  throw new Error('Tattoo design reference exceeds the provider input limit');
}
