// @vitest-environment jsdom
import React, { useState } from 'react';
import {
  tattooResolutionPolicy,
  type TattooResolution,
} from '@/lib/tattoo-resolution';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, expect, it, vi } from 'vitest';

import messages from '@/config/locale/messages/en/common.json';
import { TattooGenerator } from '@/shared/blocks/tattoo/tattoo-generator';

const mocks = vi.hoisted(() => ({ generate: vi.fn(), push: vi.fn() }));
vi.mock('@/hooks/use-credits', () => ({
  useCredits: () => ({ credits: 2, loading: false, refresh: vi.fn() }),
}));
vi.mock('@/hooks/use-generation', () => ({
  useGeneration: () => {
    const [resolution, setResolution] = useState<TattooResolution>('1K');
    return {
      resolution,
      setResolution,
      creditsCost: tattooResolutionPolicy(resolution).credits,
      status: 'ready',
      photoKey: 'uploads/member/photo.png',
      photoUrl: 'https://example.com/photo.png',
      prompt: 'Wolf',
      setPrompt: vi.fn(),
      generate: mocks.generate,
      result: null,
      error: null,
      clearPhoto: vi.fn(),
    };
  },
}));
vi.mock('@/core/i18n/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
vi.mock('@/shared/blocks/tattoo/image-uploader', () => ({
  ImageUploader: () => null,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('quotes 1/2/3 credits and lets a two-credit user lower 4K to 2K without forcing a purchase', async () => {
  mocks.generate.mockResolvedValue(undefined);
  render(
    <NextIntlClientProvider locale="en" messages={{ common: messages }}>
      <TattooGenerator />
    </NextIntlClientProvider>
  );
  expect(
    (
      screen.getByRole('radio', {
        name: '1K, 1 credit per set',
      }) as HTMLInputElement
    ).checked
  ).toBe(true);
  fireEvent.click(screen.getByRole('radio', { name: '4K, 3 credits per set' }));
  expect(screen.getByRole('button', { name: 'Buy credits' })).not.toBeNull();
  expect(screen.getByRole('status').textContent).toContain(
    'Choose a lower resolution'
  );
  fireEvent.click(screen.getByRole('radio', { name: '2K, 2 credits per set' }));
  expect(screen.queryByRole('button', { name: 'Buy credits' })).toBeNull();
  fireEvent.click(
    screen.getByRole('button', { name: /Generate My Tattoo Preview/ })
  );
  await waitFor(() => expect(mocks.generate).toHaveBeenCalledOnce());
  expect(mocks.push).not.toHaveBeenCalled();
});
