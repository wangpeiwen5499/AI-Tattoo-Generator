// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { StudioPanel } from '@/shared/blocks/tattoo/studio-panel';

afterEach(cleanup);
it('folds without unmounting edits and switching only requests navigation', () => {
  const onOpen = vi.fn();
  const props = {
    step: 2,
    title: 'Choose design',
    summary: 'Design ready',
    complete: true,
    disabled: false,
    onOpen,
  };
  const view = render(
    <StudioPanel {...props} open>
      <input aria-label="Idea" defaultValue="fern" />
    </StudioPanel>
  );
  fireEvent.change(screen.getByLabelText('Idea'), {
    target: { value: 'wolf' },
  });
  view.rerender(
    <StudioPanel {...props} open={false}>
      <input aria-label="Idea" defaultValue="fern" />
    </StudioPanel>
  );
  expect(screen.queryByRole('textbox')).toBeNull();
  expect((screen.getByLabelText('Idea') as HTMLInputElement).value).toBe(
    'wolf'
  );
  fireEvent.click(screen.getByRole('button', { name: /Choose design/ }));
  expect(onOpen).toHaveBeenCalledOnce();
  view.rerender(
    <StudioPanel {...props} open>
      <input aria-label="Idea" defaultValue="fern" />
    </StudioPanel>
  );
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('wolf');
});
