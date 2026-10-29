// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import messages from '@/config/locale/messages/en/pages/index.json';
import { Testimonials } from '@/themes/default/blocks/testimonials';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) =>
    (({ pause: 'Pause reviews', play: 'Play reviews' }) as any)[key],
}));
vi.mock('@/shared/blocks/common', () => ({
  LazyImage: (props: any) => React.createElement('img', props),
}));

afterEach(cleanup);
it('lets readers pause and restart the scrolling reviews without duplicating accessible quotes', () => {
  render(<Testimonials section={messages.page.sections.testimonials} />);
  const control = screen.getByRole('button', { name: 'Pause reviews' });
  expect(control.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(control);
  expect(
    screen
      .getByRole('button', { name: 'Play reviews' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', { name: 'Play reviews' }));
  expect(screen.getByRole('button', { name: 'Pause reviews' })).not.toBeNull();
  expect(screen.getAllByRole('blockquote')).toHaveLength(3);
});
