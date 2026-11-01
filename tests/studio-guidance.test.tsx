// @vitest-environment jsdom
import React from 'react';
import type { useStudio } from '@/hooks/use-studio';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { StudioAccount } from '@/shared/blocks/tattoo/studio-actions';
import {
  StepHelp,
  StepHint,
  studioStep,
  StudioSteps,
  studioTaskKind,
} from '@/shared/blocks/tattoo/studio-guidance';

vi.mock('@/core/i18n/navigation', () => ({
  Link: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
);
afterEach(cleanup);
const account = (signedIn: boolean, gate: number | null = null) =>
  ({
    capabilities: {
      signedIn,
      verified: signedIn,
      configured: true,
      credits: 3,
      pending: [],
    },
    gate,
    error: '',
    busy: false,
    pending: null,
  }) as unknown as ReturnType<typeof useStudio>;
it('hides redundant guest account tools but preserves contextual sign-in requests', () => {
  const view = render(<StudioAccount studio={account(false)} locale="en" />);
  expect(screen.queryByText('My designs')).toBeNull();
  expect(screen.queryByText('History')).toBeNull();
  expect(screen.queryByText('Create account / sign in')).toBeNull();
  expect(
    screen.queryByText('Sign up and verify your email for 3 free credits')
  ).toBeNull();
  view.rerender(<StudioAccount studio={account(false, 401)} locale="en" />);
  expect(
    screen.getByRole('link', { name: 'Continue' }).getAttribute('href')
  ).toContain('/sign-in');
  view.rerender(<StudioAccount studio={account(true)} locale="en" />);
  expect(screen.getByText('3 credits')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'My designs' })).toBeTruthy();
});
it('derives the next step from real assets and task state, including editing a result', () => {
  expect(
    studioStep({
      photo: false,
      design: false,
      result: false,
      showResult: false,
    })
  ).toBe(1);
  expect(
    studioStep({ photo: true, design: false, result: false, showResult: false })
  ).toBe(2);
  expect(
    studioStep({ photo: true, design: true, result: false, showResult: false })
  ).toBe(3);
  expect(
    studioStep({
      photo: true,
      design: true,
      result: false,
      showResult: false,
      task: 'render',
    })
  ).toBe(4);
  expect(
    studioStep({ photo: true, design: true, result: true, showResult: true })
  ).toBe(4);
  expect(
    studioStep({ photo: true, design: true, result: true, showResult: false })
  ).toBe(3);
});
it('shows a new render after a failed design rather than the retained old task kind', () => {
  const kind = studioTaskKind({
    busy: true,
    phase: 'uploading',
    action: 'render',
    task: 'design',
  });
  expect(
    studioStep({
      photo: true,
      design: true,
      result: false,
      showResult: false,
      task: kind,
    })
  ).toBe(4);
  expect(
    studioTaskKind({
      busy: true,
      phase: 'submitting',
      action: 'design',
      task: 'render',
    })
  ).toBe('design');
  expect(
    studioTaskKind({
      busy: true,
      phase: 'running',
      action: 'design',
      task: 'render',
    })
  ).toBe('render');
  expect(
    studioTaskKind({ busy: false, phase: '', task: 'render' })
  ).toBeUndefined();
});
it('lets users revisit ready steps without submitting anything', () => {
  const select = vi.fn();
  render(
    <StudioSteps
      locale="en"
      current={3}
      completed={[true, true, false, false]}
      onSelect={select}
    />
  );
  expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', { name: /Choose photo/ }));
  expect(select).toHaveBeenCalledWith(1);
  expect(
    (screen.getByRole('button', { name: /Real result/ }) as HTMLButtonElement)
      .disabled
  ).toBe(true);
});
it('opens help only on demand and allows Escape and dismissal', () => {
  render(
    <>
      <StepHelp label="About designs">Design saving is free.</StepHelp>
      <StepHint onDismiss={vi.fn()} locale="en">
        Choose your photo next.
      </StepHint>
    </>
  );
  expect(screen.queryByText('Design saving is free.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'About designs' }));
  expect(screen.getByText('Design saving is free.')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.queryByText('Design saving is free.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Dismiss tip' })).toBeTruthy();
});
