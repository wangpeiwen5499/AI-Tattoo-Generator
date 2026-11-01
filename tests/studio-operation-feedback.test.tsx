// @vitest-environment jsdom
import React from 'react';
import type { useStudio } from '@/hooks/use-studio';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import {
  StudioDesigns,
  StudioRender,
} from '@/shared/blocks/tattoo/studio-actions';

vi.mock('@/core/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
afterEach(cleanup);
it('does not claim AI generation while an unrelated image is opening', () => {
  const studio = {
    phase: '',
    busy: false,
    pending: null,
    capabilities: { signedIn: true },
    result: null,
  } as unknown as ReturnType<typeof useStudio>;
  render(
    <StudioDesigns
      locale="en"
      prompt="fern"
      setPrompt={() => {}}
      onUpload={() => {}}
      onPick={async () => {}}
      studio={studio}
      busy
    />
  );
  expect(
    screen
      .getByRole('button', { name: 'Generate design · 1 credit' })
      .getAttribute('aria-busy')
  ).toBe('false');
  expect(screen.queryByRole('status')).toBeNull();
});
it('puts the active design operation inside the button and near the action', () => {
  const studio = {
    phase: 'running',
    busy: true,
    pending: null,
    capabilities: { signedIn: true },
    result: null,
  } as unknown as ReturnType<typeof useStudio>;
  render(
    <StudioDesigns
      locale="en"
      prompt="fern"
      setPrompt={() => {}}
      onUpload={() => {}}
      onPick={async () => {}}
      studio={studio}
      busy
      activeOperation="design"
    />
  );
  expect(
    screen
      .getByRole('button', { name: /Generating design/ })
      .getAttribute('aria-busy')
  ).toBe('true');
  expect(screen.getByRole('status').textContent).toContain('AI');
});
it('shows upload progress for a try-on rather than leaving the idle label', () => {
  render(
    <StudioRender
      locale="en"
      resolution="2K"
      setResolution={() => {}}
      onRender={() => {}}
      busy
      ready
      pending
      hasResult={false}
      onDownload={() => {}}
      activeOperation="render"
      phase="uploading"
    />
  );
  expect(
    screen
      .getByRole('button', { name: /Preparing try-on/ })
      .getAttribute('aria-busy')
  ).toBe('true');
  expect(screen.getByRole('status').textContent).toContain('Uploading');
});
