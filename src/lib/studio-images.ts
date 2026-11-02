import { photoCanvas } from './manual-images';
import { geometryFor, type Placement } from './manual-placement';
import { readWithRetry } from './read-retry';
import { studioAssetUrl } from './studio-client';

export async function assetImage(id: string) {
  return readWithRetry(async () => {
    const image = new Image();
    image.src = studioAssetUrl(id);
    await image.decode();
    return image;
  });
}
export async function imageBlob(image: HTMLImageElement) {
  return boundedBlob(photoCanvas(image), 'image/webp');
}
function boundedBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.size < 4 * 1024 * 1024
          ? resolve(blob)
          : reject(
              new Error(
                'Image is too large to send. Please use a smaller photo.'
              )
            ),
      type,
      0.9
    )
  );
}
export function photoBlob(canvas: HTMLCanvasElement) {
  return boundedBlob(canvas, 'image/jpeg');
}
export function placementRegion(
  placement: Placement,
  photo: HTMLCanvasElement,
  design: HTMLImageElement
) {
  const g = geometryFor(
    placement,
    photo,
    design.naturalWidth / design.naturalHeight
  );
  const a = (g.rotation * Math.PI) / 180;
  const w = Math.abs(g.width * Math.cos(a)) + Math.abs(g.height * Math.sin(a));
  const h = Math.abs(g.width * Math.sin(a)) + Math.abs(g.height * Math.cos(a));
  const x = Math.max(0, (g.cx - w / 2) / photo.width),
    y = Math.max(0, (g.cy - h / 2) / photo.height);
  return {
    x,
    y,
    width: Math.max(0.001, Math.min(1, (g.cx + w / 2) / photo.width) - x),
    height: Math.max(0.001, Math.min(1, (g.cy + h / 2) / photo.height) - y),
  };
}
