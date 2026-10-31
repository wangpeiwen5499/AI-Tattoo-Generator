import { expect, it } from 'vitest';

import {
  fitPlacement,
  pointInPhoto,
  regionFromDrag,
} from '../public/try-on-lab/geometry.mjs';

it('maps selection from a letterboxed canvas to original-photo coordinates', () => {
  expect(
    pointInPhoto({ x: 250, y: 150 }, { x: 100, y: 50, width: 300, height: 200 })
  ).toEqual({ x: 0.5, y: 0.5 });
  expect(
    pointInPhoto({ x: 50, y: 0 }, { x: 100, y: 50, width: 300, height: 200 })
  ).toEqual({ x: 0, y: 0 });
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
