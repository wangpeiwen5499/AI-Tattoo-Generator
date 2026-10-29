// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import messages from '@/config/locale/messages/en/common.json';
import { TattooGenerator } from '@/shared/blocks/tattoo/tattoo-generator';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('@/core/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  Link: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => (messages.funnel as any)[key],
}));
vi.mock('@/hooks/use-credits', () => ({
  useCredits: () => ({ credits: 0, loading: false, refresh: mocks.refresh }),
}));
vi.mock('@/hooks/use-generation', () => ({
  useGeneration: () => ({
    status: 'completed',
    result: {
      tattooDesignUrl: 'https://images.example/design.png',
      images: [
        {
          bodyPart: 'left_arm',
          status: 'completed',
          url: 'https://images.example/left.png',
        },
      ],
    },
    reset: mocks.reset,
    resetPrompt: vi.fn(),
  }),
}));

afterEach(cleanup);
it('preserves results and saving when the last credit is used, and waits for a purchase click', () => {
  render(<TattooGenerator />);
  expect(
    screen.getByAltText('Generated tattoo design').getAttribute('src')
  ).toContain('design.png');
  expect(
    screen.getByRole('link', { name: 'Buy credits' }).getAttribute('href')
  ).toBe('/pricing');
  expect(mocks.push).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole('link', { name: 'Save tattoo design' })
      .getAttribute('href')
  ).toContain('/api/proxy/file?url=');
  fireEvent.click(screen.getByRole('button', { name: 'Buy credits' }));
  expect(mocks.push).toHaveBeenCalledWith('/pricing');
});
