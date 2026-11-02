// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { LibraryImage } from '@/shared/blocks/tattoo/library-image';

vi.mock('next-intl', () => ({ useLocale: () => 'en' }));
afterEach(cleanup);
it('keeps the thumbnail layout and offers an explicit retry after a failed image', () => {
  const { container } = render(
    <LibraryImage
      src="/api/studio?asset=one"
      alt="Rose design"
      className="h-48 w-full rounded-xl"
    />
  );
  const image = screen.getByAltText('Rose design');
  expect(image.getAttribute('loading')).toBe('lazy');
  fireEvent.error(image);
  expect(screen.getByRole('status').textContent).toContain(
    'Could not load image'
  );
  expect(container.firstElementChild?.className).toContain('h-48');
  fireEvent.click(screen.getByRole('button', { name: 'Retry image' }));
  const retried = screen.getByAltText('Rose design');
  expect(retried.getAttribute('src')).toContain('asset=one');
  expect(retried.getAttribute('src')).toContain('thumbnailRetry=1');
  expect(screen.queryByRole('button', { name: 'Retry image' })).toBeNull();
  fireEvent.error(retried);
  expect(screen.getByRole('button', { name: 'Retry image' })).toBeTruthy();
});
