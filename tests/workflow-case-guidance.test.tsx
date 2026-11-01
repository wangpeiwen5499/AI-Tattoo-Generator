// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { WorkflowCase } from '@/shared/blocks/tattoo/preview-workflow-case';

vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
vi.mock('next/image', () => ({
  default: ({
    unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Deliberate next/image test double.
    <img {...props} alt={props.alt || ''} />
  ),
}));
vi.mock('@/shared/blocks/tattoo/lightbox', () => ({ Lightbox: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('highlights only the next example action and shows a dismissible tip without API requests', () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  render(<WorkflowCase />);
  expect(
    screen.getByRole('button', { name: 'Use this sample photo' }).className
  ).toContain('studio-current-action');
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss tip' }));
  expect(
    screen.queryByText(
      'Choose the sample photo to begin with clearly visible skin.'
    )
  ).toBeNull();
  const labels = [
    'Use this sample photo',
    'Reveal uploaded design',
    'Apply preset placement',
    'View saved AI result',
  ];
  labels.forEach((label) => {
    const action = screen.getByRole('button', { name: label });
    expect(action.className).toContain('studio-current-action');
    fireEvent.click(action);
  });
  expect(
    screen.getByRole('link', { name: 'Try your own photo in the studio' })
      .className
  ).toContain('studio-current-action');
  expect(
    screen.getByText(
      'You have finished all four steps. Compare the original or try your own photo in the studio.'
    )
  ).toBeTruthy();
  expect(fetcher).not.toHaveBeenCalled();
});
