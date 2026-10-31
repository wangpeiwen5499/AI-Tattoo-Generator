// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { PreviewWorkflowCase } from '@/shared/blocks/tattoo/preview-workflow-case';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('reveals a real design only after choosing the sample, then shows one disclosed fixed result without API calls', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<PreviewWorkflowCase locale="en" />);
  const reveal = screen.getByRole('button', {
    name: 'Reveal saved design',
  }) as HTMLButtonElement;
  expect(reveal.disabled).toBe(true);
  fireEvent.click(
    screen.getByRole('button', { name: 'Use this sample photo' })
  );
  fireEvent.click(reveal);
  expect(
    screen
      .getByAltText('Saved geometric wolf tattoo design')
      .getAttribute('src')
  ).toContain('/design.webp');
  expect(
    screen.getByText(/symmetrical black-and-grey geometric wolf head/)
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole('button', { name: 'View fixed example AI result' })
  );
  expect(
    screen.getByAltText('Saved AI calf example result').getAttribute('src')
  ).toContain('/calf.webp');
  expect(
    screen.getByText(/does not reflect your edited placement/)
  ).toBeTruthy();
  expect(
    screen
      .getByRole('link', { name: 'Render your placement in the studio' })
      .getAttribute('href')
  ).toBe('/try-on-lab/index.html?lang=en');
  expect(fetch).not.toHaveBeenCalled();
});
it('supports pointer movement and resizing, preserves a clearly labeled layout, and resets the calf preset', () => {
  vi.stubGlobal('PointerEvent', MouseEvent);
  render(<PreviewWorkflowCase locale="en" />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Use this sample photo' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reveal saved design' }));
  const photo = screen.getByTestId('workflow-placement-photo');
  vi.spyOn(photo, 'getBoundingClientRect').mockReturnValue({
    width: 400,
    height: 540,
    left: 0,
    top: 0,
    right: 400,
    bottom: 540,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const design = screen.getByRole('button', { name: 'Move tattoo design' });
  const initial = design.style.left;
  fireEvent.pointerDown(design, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(design, { clientX: 140, clientY: 120 });
  fireEvent.pointerUp(design);
  expect(design.style.left).not.toBe(initial);
  const handle = screen.getByRole('button', { name: 'Resize tattoo design' });
  const width = design.style.width;
  fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(handle, { clientX: 125, clientY: 110 });
  fireEvent.pointerUp(handle);
  expect(design.style.width).not.toBe(width);
  fireEvent.click(screen.getByRole('button', { name: 'Reset calf preset' }));
  expect(design.style.left).toBe(initial);
  expect(screen.getByText(/Layout overlay only/)).toBeTruthy();
});
