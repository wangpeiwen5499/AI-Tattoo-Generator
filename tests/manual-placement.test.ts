import {
  constrainPlacement,
  defaultPlacement,
  drawManual,
  geometryFor,
  hitPlacement,
  pointOnPhoto,
  transformGesture,
} from '@/lib/manual-placement';
import { expect, it, vi } from 'vitest';

it('maps pointer coordinates through letterboxing without selecting outside the photo', () => {
  const rect = { left: 10, top: 20, width: 400, height: 400 };
  expect(
    pointOnPhoto({ x: 210, y: 220 }, rect, { width: 1000, height: 500 })
  ).toEqual({ x: 0.5, y: 0.5 });
  expect(
    pointOnPhoto({ x: 210, y: 50 }, rect, { width: 1000, height: 500 })
  ).toBeNull();
});

it('keeps a rotated design hit-test aligned to the original photo', () => {
  const g = geometryFor(
    { ...defaultPlacement(), rotation: 90 },
    { width: 1000, height: 1000 },
    2
  );
  expect(
    hitPlacement({ x: 0.5, y: 0.64 }, g, { width: 1000, height: 1000 })
  ).toBe(true);
  expect(
    hitPlacement({ x: 0.64, y: 0.5 }, g, { width: 1000, height: 1000 })
  ).toBe(false);
});

it('combines two-finger translation, scale and rotation in photo coordinates', () => {
  const p = defaultPlacement();
  const size = { width: 1000, height: 1000 };
  const start = [
    { x: 0.25, y: 0.5 },
    { x: 0.75, y: 0.5 },
  ];
  const rotated = transformGesture(
    start,
    [
      { x: 0.5, y: 0.25 },
      { x: 0.5, y: 0.75 },
    ],
    p,
    size
  );
  expect(rotated.rotation).toBeCloseTo(90);
  expect(rotated.scale).toBeCloseTo(1);
  const scaled = transformGesture(
    start,
    [
      { x: 0, y: 0.6 },
      { x: 1, y: 0.6 },
    ],
    p,
    size
  );
  expect(scaled.scale).toBeCloseTo(2);
  expect(scaled.py).toBeCloseTo(0.6);
});

it('bounds positions, ink and size and normalizes full rotations', () => {
  const p = constrainPlacement({
    ...defaultPlacement(),
    px: -1,
    py: 2,
    scale: 30,
    rotation: 725,
    opacity: -3,
  });
  expect(p).toMatchObject({
    px: 0,
    py: 1,
    scale: 4,
    rotation: 5,
    opacity: 0.05,
  });
});

it('renders the export without editor handles and respects flipping and ink', () => {
  const ctx = {
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    scale: vi.fn(),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
  };
  const photo = { width: 1000, height: 500 } as HTMLCanvasElement;
  const design = { naturalWidth: 300, naturalHeight: 600 } as HTMLImageElement;
  drawManual(ctx as unknown as CanvasRenderingContext2D, photo, design, {
    ...defaultPlacement(),
    flipped: true,
    opacity: 0.4,
  });
  expect(ctx.drawImage).toHaveBeenCalledTimes(2);
  expect(ctx.scale).toHaveBeenCalledWith(-1, 1);
  expect(ctx.globalAlpha).toBe(0.4);
  expect(ctx.globalCompositeOperation).toBe('multiply');
  ctx.drawImage.mockClear();
  drawManual(
    ctx as unknown as CanvasRenderingContext2D,
    photo,
    design,
    defaultPlacement(),
    true
  );
  expect(ctx.drawImage).toHaveBeenCalledTimes(1);
});
