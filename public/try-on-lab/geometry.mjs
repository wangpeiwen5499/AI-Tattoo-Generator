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
