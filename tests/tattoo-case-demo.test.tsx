// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import common from '@/config/locale/messages/en/common.json';
import messages from '@/config/locale/messages/en/pages/index.json';
import { TattooCaseDemo } from '@/shared/blocks/tattoo/tattoo-case-demo';

vi.mock('next/image', () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: any) => React.createElement('img', props),
}));
vi.mock('@/core/auth/client', () => ({
  useSession: () => ({ data: null, isPending: false }),
}));
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    namespace === 'common.funnel'
      ? (common.funnel as any)[key]
      : (messages.page.sections.hero as any).demo[key],
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));

afterEach(cleanup);

function generateExample() {
  fireEvent.click(screen.getByRole('button', { name: 'Use this photo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reveal tattoo design' }));
}

describe('homepage interactive tattoo case', () => {
  it('returns keyboard focus to the opener after closing the single-image preview', async () => {
    render(<TattooCaseDemo />);
    const opener = screen.getByRole('button', { name: 'Enlarge preview' });
    opener.focus();
    fireEvent.click(opener);
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('describes the available single-image action in the lightbox', () => {
    render(<TattooCaseDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'Enlarge preview' }));
    expect(
      screen.getByText('Press Escape to close the preview.')
    ).not.toBeNull();
  });
  it('shows the original, design and directly usable placements on first visit', () => {
    render(<TattooCaseDemo />);
    expect(
      screen.getByTestId('tattoo-case-photo').getAttribute('src')
    ).toContain('/before.webp');
    expect(
      (screen.getByRole('button', { name: 'Left arm' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
    expect(
      (
        screen.getByRole('button', {
          name: 'Reveal tattoo design',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false);
    expect(
      screen
        .getByAltText('Generated geometric wolf tattoo design')
        .getAttribute('src')
    ).toContain('/design.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Calf' }));
    expect(
      screen.getByTestId('tattoo-case-photo').getAttribute('src')
    ).toContain('/calf.webp');
  });

  it('enlarges the original and wolf design independently and restores focus to each opener', async () => {
    render(<TattooCaseDemo />);
    for (const [label, alt, file] of [
      [
        'Enlarge original photo',
        'Full-body photo of a man without tattoos',
        'before',
      ],
      [
        'Enlarge tattoo design',
        'Generated geometric wolf tattoo design',
        'design',
      ],
    ]) {
      const trigger = screen.getByRole('button', { name: label });
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog');
      expect(dialog.querySelector('img')?.getAttribute('src')).toContain(
        '/' + file + '.webp'
      );
      expect(dialog.querySelector('img')?.getAttribute('alt')).toBe(alt);
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  });

  it('reveals the actual wolf design and switches every anatomical placement without an API call', () => {
    const fetch = vi.fn(() => {
      throw new Error('The demo must not spend credits');
    });
    vi.stubGlobal('fetch', fetch);
    render(<TattooCaseDemo />);
    generateExample();
    expect(
      screen
        .getByAltText('Generated geometric wolf tattoo design')
        .getAttribute('src')
    ).toContain('/design.webp');
    for (const [label, file] of [
      ['Left arm', 'left-arm'],
      ['Right arm', 'right-arm'],
      ['Shoulder', 'shoulder'],
      ['Calf', 'calf'],
    ]) {
      const button = screen.getByRole('button', { name: label });
      fireEvent.click(button);
      expect(button.getAttribute('aria-pressed')).toBe('true');
      expect(
        screen.getByTestId('tattoo-case-photo').getAttribute('src')
      ).toContain(`/${file}.webp`);
    }
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('compares the selected placement with the original and can restart the whole example', () => {
    render(<TattooCaseDemo />);
    generateExample();
    fireEvent.click(screen.getByRole('button', { name: 'Calf' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show original' }));
    expect(
      screen.getByTestId('tattoo-case-photo').getAttribute('src')
    ).toContain('/before.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Show tattoo' }));
    expect(
      screen.getByTestId('tattoo-case-photo').getAttribute('src')
    ).toContain('/calf.webp');
    fireEvent.click(screen.getByRole('button', { name: 'Restart example' }));
    expect(
      screen.getByTestId('tattoo-case-photo').getAttribute('src')
    ).toContain('/before.webp');
    expect(
      (screen.getByRole('button', { name: 'Left arm' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);
    expect(
      screen.getByAltText('Generated geometric wolf tattoo design')
    ).not.toBeNull();
  });
});
