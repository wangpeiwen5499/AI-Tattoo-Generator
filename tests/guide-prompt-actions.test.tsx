// @vitest-environment jsdom
import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { GuidePromptActions } from '@/shared/blocks/common/guide-prompt-actions';

vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ href, children }: any) => (
    <a href={`${href.pathname}?${new URLSearchParams(href.query)}`}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);
it('copies the complete prompt and carries special characters into the editable studio link', async () => {
  const prompt = 'A rose & moon + fine lines?';
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  render(<GuidePromptActions prompt={prompt} zh={false} />);
  fireEvent.click(screen.getByRole('button', { name: 'Copy prompt' }));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('Copied')
  );
  expect(writeText).toHaveBeenCalledWith(prompt);
  const href = screen.getByRole('link').getAttribute('href')!;
  expect(new URL(href, 'https://example.com').searchParams.get('prompt')).toBe(
    prompt
  );
});
it('offers manual copying when clipboard permission is unavailable', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
  });
  render(<GuidePromptActions prompt="rose" zh={true} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('复制失败')
  );
});
