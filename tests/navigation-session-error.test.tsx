// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { SignUser } from '@/shared/blocks/sign/sign-user';

const state = vi.hoisted(() => ({
  user: null as any,
  error: new Error('offline') as Error | null,
  pending: false,
  setUser: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock('@/core/auth/client', () => ({
  useSession: () => ({
    data: null,
    isPending: state.pending,
    error: state.error,
    refetch: state.refetch,
  }),
  signOut: vi.fn(),
}));
vi.mock('@/core/i18n/navigation', () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@/shared/contexts/app', () => ({
  useAppContext: () => ({
    configs: { ready: 'yes' },
    user: state.user,
    setUser: state.setUser,
    fetchUserInfo: vi.fn(),
    fetchUserCredits: vi.fn(),
    setIsCheckSign: vi.fn(),
    fetchConfigs: vi.fn(),
    showOneTap: vi.fn(),
    setIsShowSignModal: vi.fn(),
    isCheckSign: false,
  }),
}));
vi.mock('@/shared/blocks/sign/sign-modal', () => ({ SignModal: () => null }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.user = null;
  state.error = new Error('offline');
  state.pending = false;
});
it('does not turn a failed session read into a sign-in action', () => {
  render(<SignUser />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Retry account connection' })
  );
  expect(state.refetch).toHaveBeenCalledOnce();
  expect(screen.queryByText('sign_in_title')).toBeNull();
});
it('preserves the last confirmed user when the session lookup fails', () => {
  state.user = {
    id: 'user1',
    name: 'Test',
    email: 'test@example.com',
    credits: { remainingCredits: 3 },
  };
  render(<SignUser />);
  expect(state.setUser).not.toHaveBeenCalledWith(null);
});
it('clears the confirmed user only after a successful anonymous lookup', () => {
  state.user = { id: 'user1', name: 'Test' };
  state.error = null;
  render(<SignUser />);
  expect(state.setUser).toHaveBeenCalledWith(null);
});
