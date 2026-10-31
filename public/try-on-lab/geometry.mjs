/** @typedef {{x:number,y:number,width:number,height:number}} Region */
/** @param {{x:number,y:number}} point @param {Region} bounds */
export function pointInPhoto(point, bounds) {
  return {
    x: Math.max(0, Math.min(1, (point.x - bounds.x) / bounds.width)),
    y: Math.max(0, Math.min(1, (point.y - bounds.y) / bounds.height)),
  };
}
/** @param {{x:number,y:number}} a @param {{x:number,y:number}} b */
export function regionFromDrag(a, b) {
  const r = {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
  return r.width < 0.025 || r.height < 0.025 ? null : r;
}
/** @param {Region} region @param {number} aspect @param {number} photoWidth @param {number} photoHeight */
export function fitPlacement(region, aspect, photoWidth, photoHeight) {
  const maxW = region.width * photoWidth * 0.8,
    maxH = region.height * photoHeight * 0.8;
  const height = Math.min(maxH, maxW / aspect);
  return { width: height * aspect, height };
}

/** Design dimensions and center in original-photo pixels. */
export function placementGeometry(placement, aspect, width, height) {
  const fit = fitPlacement(
    { x: 0, y: 0, width: 0.4, height: 0.5 },
    aspect,
    width,
    height
  );
  return {
    cx: placement.px * width,
    cy: placement.py * height,
    width: fit.width * placement.scale,
    height: fit.height * placement.scale,
    rotation: placement.rotation,
  };
}

/** A padded render region, bounded to the photo and valid for the lab API. */
export function placementRegion(g, width, height) {
  const angle = (g.rotation * Math.PI) / 180;
  const rw =
    (Math.abs(g.width * Math.cos(angle)) +
      Math.abs(g.height * Math.sin(angle))) *
    1.5;
  const rh =
    (Math.abs(g.width * Math.sin(angle)) +
      Math.abs(g.height * Math.cos(angle))) *
    1.5;
  const halfWidth = Math.max(rw / width, 0.04) / 2;
  const halfHeight = Math.max(rh / height, 0.04) / 2;
  const left = Math.max(0, g.cx / width - halfWidth);
  const top = Math.max(0, g.cy / height - halfHeight);
  const right = Math.min(1, g.cx / width + halfWidth);
  const bottom = Math.min(1, g.cy / height + halfHeight);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function hitPlacement(point, g, width, height) {
  const angle = (-g.rotation * Math.PI) / 180;
  const dx = point.x * width - g.cx,
    dy = point.y * height - g.cy;
  return (
    Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle)) <= g.width / 2 &&
    Math.abs(dx * Math.sin(angle) + dy * Math.cos(angle)) <= g.height / 2
  );
}

export function transformGesture(start, current, placement, width, height) {
  const vector = (points) => ({
    x: (points[1].x - points[0].x) * width,
    y: (points[1].y - points[0].y) * height,
  });
  const a = vector(start),
    b = vector(current);
  const distance = Math.hypot(a.x, a.y);
  const angle = ((Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x)) * 180) / Math.PI;
  return {
    px:
      placement.px +
      (current[0].x + current[1].x - start[0].x - start[1].x) / 2,
    py:
      placement.py +
      (current[0].y + current[1].y - start[0].y - start[1].y) / 2,
    scale:
      placement.scale * (distance > 1 ? Math.hypot(b.x, b.y) / distance : 1),
    rotation: placement.rotation + angle,
  };
}
