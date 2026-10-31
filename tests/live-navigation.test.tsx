// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { AccountNavigation } from '@/shared/blocks/tattoo/account-navigation';

const session = vi.hoisted(() => ({
  data: null as null | { user: { id: string } },
}));
vi.mock('@/core/auth/client', () => ({
  useSession: () => session,
  signOut: vi.fn(),
}));
afterEach(() => {
  session.data = null;
  cleanup();
});
it('offers sign-in returning to the localized studio for guests', () => {
  render(<AccountNavigation locale="zh" />);
  expect(screen.getByRole('link').getAttribute('href')).toBe(
    '/zh/sign-in?callbackUrl=%2Fzh%2Fgenerate'
  );
});
it('keeps account, credit history, purchases and sign-out reachable for members', () => {
  session.data = { user: { id: 'member' } };
  render(<AccountNavigation locale="en" />);
  expect(screen.getByText('Credit history').getAttribute('href')).toBe(
    '/settings/credits'
  );
  expect(screen.getByText('Purchases').getAttribute('href')).toBe(
    '/settings/payments'
  );
  expect(screen.getByText('Account settings').getAttribute('href')).toBe(
    '/settings/profile'
  );
  expect(screen.getByText('Sign out').tagName).toBe('BUTTON');
});
