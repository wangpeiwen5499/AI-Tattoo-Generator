async function decode(src: string) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (image.naturalWidth * image.naturalHeight > 40_000_000)
    throw new Error('pixels');
  return image;
}
async function fileImage(file: File) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > 20 * 1024 * 1024
  )
    throw new Error('file');
  const url = URL.createObjectURL(file);
  try {
    return await decode(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}
function photoCanvas(image: HTMLImageElement) {
  const scale = Math.min(
    1,
    2560 / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}
export async function loadPhoto(file: File) {
  return photoCanvas(await fileImage(file));
}
export const loadDesign = fileImage;
export async function loadSample() {
  const [photo, design] = await Promise.all([
    decode('/imgs/cases/geometric-wolf/before.webp'),
    decode('/imgs/cases/geometric-wolf/design.webp'),
  ]);
  return { photo: photoCanvas(photo), design };
}
export const canvasBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('export'))),
      'image/png'
    )
  );
