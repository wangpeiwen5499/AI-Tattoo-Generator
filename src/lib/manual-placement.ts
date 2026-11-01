export type Point = { x: number; y: number };
export type Size = { width: number; height: number };
export type Placement = {
  px: number;
  py: number;
  scale: number;
  rotation: number;
  opacity: number;
  flipped: boolean;
};
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export const defaultPlacement = (): Placement => ({
  px: 0.5,
  py: 0.5,
  scale: 1,
  rotation: 0,
  opacity: 0.8,
  flipped: false,
});
export function constrainPlacement(p: Placement): Placement {
  return {
    ...p,
    px: clamp(p.px, 0, 1),
    py: clamp(p.py, 0, 1),
    scale: clamp(p.scale, 0.1, 4),
    opacity: clamp(p.opacity, 0.05, 1),
    rotation: ((p.rotation % 360) + 360) % 360,
  };
}
export function geometryFor(p: Placement, size: Size, aspect: number) {
  const height =
    Math.min(size.height * 0.4, (size.width * 0.32) / aspect) * p.scale;
  return {
    cx: p.px * size.width,
    cy: p.py * size.height,
    width: height * aspect,
    height,
    rotation: p.rotation,
  };
}
export function hitPlacement(
  point: Point,
  g: ReturnType<typeof geometryFor>,
  size: Size
) {
  const a = (-g.rotation * Math.PI) / 180,
    dx = point.x * size.width - g.cx,
    dy = point.y * size.height - g.cy;
  return (
    Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= g.width / 2 &&
    Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= g.height / 2
  );
}
export function pointOnPhoto(
  point: Point,
  rect: Size & { left: number; top: number },
  size: Size
): Point | null {
  const scale = Math.min(rect.width / size.width, rect.height / size.height);
  const x =
    (point.x - rect.left - (rect.width - size.width * scale) / 2) /
    (size.width * scale);
  const y =
    (point.y - rect.top - (rect.height - size.height * scale) / 2) /
    (size.height * scale);
  return x < 0 || x > 1 || y < 0 || y > 1 ? null : { x, y };
}
export function transformGesture(
  start: Point[],
  current: Point[],
  p: Placement,
  size: Size
): Placement {
  const a = {
    x: (start[1].x - start[0].x) * size.width,
    y: (start[1].y - start[0].y) * size.height,
  };
  const b = {
    x: (current[1].x - current[0].x) * size.width,
    y: (current[1].y - current[0].y) * size.height,
  };
  const distance = Math.hypot(a.x, a.y);
  return constrainPlacement({
    ...p,
    px: p.px + (current[0].x + current[1].x - start[0].x - start[1].x) / 2,
    py: p.py + (current[0].y + current[1].y - start[0].y - start[1].y) / 2,
    scale: p.scale * (distance > 1 ? Math.hypot(b.x, b.y) / distance : 1),
    rotation:
      p.rotation +
      ((Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)) * 180) / Math.PI,
  });
}
export function drawManual(
  ctx: CanvasRenderingContext2D,
  photo: HTMLCanvasElement,
  design: HTMLImageElement | null,
  p: Placement,
  original = false
) {
  ctx.clearRect(0, 0, photo.width, photo.height);
  ctx.drawImage(photo, 0, 0);
  if (!design || original) return;
  const g = geometryFor(p, photo, design.naturalWidth / design.naturalHeight);
  ctx.save();
  ctx.translate(g.cx, g.cy);
  ctx.rotate((g.rotation * Math.PI) / 180);
  if (p.flipped) ctx.scale(-1, 1);
  ctx.globalAlpha = p.opacity;
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(design, -g.width / 2, -g.height / 2, g.width, g.height);
  ctx.restore();
}
