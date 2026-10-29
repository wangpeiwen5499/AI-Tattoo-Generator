// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import messages from '@/config/locale/messages/en/common.json';
import { GenerationAccess } from '@/shared/blocks/tattoo/generation-access';

const state = vi.hoisted(() => ({ session: null as any, pending: false }));
vi.mock('@/core/auth/client', () => ({
  useSession: () => ({ data: state.session, isPending: state.pending }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => (messages as any).funnel[key],
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) =>
    React.createElement('a', props, children),
}));
vi.mock('@/shared/blocks/tattoo/tattoo-case-demo', () => ({
  TattooCaseDemo: () => <div>Actual website example</div>,
}));
vi.mock('@/shared/blocks/tattoo/tattoo-generator', () => ({
  TattooGenerator: () => <div>Personal photo generator</div>,
}));

afterEach(cleanup);
beforeEach(() => {
  state.session = null;
  state.pending = false;
});
it('lets guests explore the actual example and routes signup back to generation', () => {
  render(<GenerationAccess />);
  expect(screen.getByText('Actual website example')).not.toBeNull();
  expect(screen.queryByText('Personal photo generator')).toBeNull();
  expect(
    screen
      .getByRole('link', { name: 'Get 3 free credits' })
      .getAttribute('href')
  ).toBe('/sign-up?callbackUrl=%2Fgenerate');
});
it('asks existing unverified users to verify instead of awarding another signup trial', () => {
  state.session = {
    user: { email: 'existing@example.com', emailVerified: false },
  };
  render(<GenerationAccess />);
  expect(
    screen.getByRole('link', { name: 'Verify email' }).getAttribute('href')
  ).toContain('/verify-email?');
  expect(screen.queryByText('Personal photo generator')).toBeNull();
});
it('mounts the personal generator only for a verified signed-in account', () => {
  state.session = {
    user: { email: 'member@example.com', emailVerified: true },
  };
  render(<GenerationAccess />);
  expect(screen.getByText('Personal photo generator')).not.toBeNull();
  expect(screen.queryByText('Actual website example')).toBeNull();
});
