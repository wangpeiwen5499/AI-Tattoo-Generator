import { expect, it } from 'vitest';

import {
  fitPlacement,
  hitPlacement,
  placementGeometry,
  placementRegion,
  pointInPhoto,
  regionFromDrag,
  transformGesture,
} from '../public/try-on-lab/geometry.mjs';

it('maps selection from a letterboxed canvas to original-photo coordinates', () => {
  expect(
    pointInPhoto({ x: 250, y: 150 }, { x: 100, y: 50, width: 300, height: 200 })
  ).toEqual({ x: 0.5, y: 0.5 });
  expect(
    pointInPhoto({ x: 50, y: 0 }, { x: 100, y: 50, width: 300, height: 200 })
  ).toEqual({ x: 0, y: 0 });
});

it('places designs in original-photo coordinates without requiring a selected region', () => {
  const g = placementGeometry(
    { px: 0.7, py: 0.4, scale: 1, rotation: 0 },
    0.5,
    1000,
    1500
  );
  expect(g.cx).toBe(700);
  expect(g.cy).toBe(600);
  expect(g.width / g.height).toBeCloseTo(0.5);
  expect(hitPlacement({ x: 0.7, y: 0.4 }, g, 1000, 1500)).toBe(true);
  expect(hitPlacement({ x: 0.1, y: 0.1 }, g, 1000, 1500)).toBe(false);
});

it('derives padded rotated render bounds and clips them to the photo', () => {
  const g = { cx: 500, cy: 750, width: 200, height: 400, rotation: 90 };
  const r = placementRegion(g, 1000, 1500);
  expect(r.x).toBeCloseTo(0.2);
  expect(r.y).toBeCloseTo(0.4);
  expect(r.width).toBeCloseTo(0.6);
  expect(r.height).toBeCloseTo(0.2);
  const edge = placementRegion({ ...g, cx: 0, cy: 0 }, 1000, 1500);
  expect(edge.x).toBe(0);
  expect(edge.y).toBe(0);
  expect(edge.x + edge.width).toBeLessThanOrEqual(1);
  expect(edge.y + edge.height).toBeLessThanOrEqual(1);
});

it('hit tests a rotated design using its local axes', () => {
  const g = { cx: 500, cy: 500, width: 100, height: 400, rotation: 90 };
  expect(hitPlacement({ x: 0.65, y: 0.5 }, g, 1000, 1000)).toBe(true);
  expect(hitPlacement({ x: 0.5, y: 0.65 }, g, 1000, 1000)).toBe(false);
});

it('keeps thin edge placements large enough for the render API', () => {
  const r = placementRegion(
    { cx: 1000, cy: 0, width: 3, height: 50, rotation: 0 },
    1000,
    1500
  );
  expect(r.width).toBeGreaterThanOrEqual(0.015);
  expect(r.height).toBeGreaterThanOrEqual(0.015);
  expect(r.x + r.width).toBeLessThanOrEqual(1);
  expect(r.y).toBe(0);
});

it('uses pixel distances for pinch scaling and rotation on a portrait photo', () => {
  const result = transformGesture(
    [
      { x: 0.4, y: 0.5 },
      { x: 0.6, y: 0.5 },
    ],
    [
      { x: 0.6, y: 0.4 },
      { x: 0.6, y: 0.6 },
    ],
    { px: 0.5, py: 0.5, scale: 1, rotation: 0 },
    1000,
    2000
  );
  expect(result.scale).toBeCloseTo(2);
  expect(result.rotation).toBeCloseTo(90);
  expect(result.px).toBeCloseTo(0.6);
  expect(result.py).toBeCloseTo(0.5);
});
it('normalizes reverse-direction drags and rejects accidental tiny selections', () => {
  expect(regionFromDrag({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.3 })).toMatchObject({
    x: 0.2,
    y: 0.3,
  });
  expect(regionFromDrag({ x: 0.1, y: 0.1 }, { x: 0.101, y: 0.101 })).toBeNull();
});
it('fits a tall design inside the selected region while preserving its proportions', () => {
  const fit = fitPlacement(
    { x: 0.2, y: 0.1, width: 0.3, height: 0.4 },
    0.5,
    1000,
    1500
  );
  expect(fit.width / fit.height).toBeCloseTo(0.5);
  expect(fit.height).toBeLessThanOrEqual(600);
  expect(fit.width).toBeLessThanOrEqual(300);
});
