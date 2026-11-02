// @vitest-environment jsdom
import { useUnsavedStudio } from '@/hooks/use-unsaved-studio';
import { cleanup, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});
it('protects unsaved work on refresh and cancels navigation, but allows same-page anchors', () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderHook(() => useUnsavedStudio(true, 'Unsaved work'));
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  document.body.innerHTML =
    '<a href="/pricing">Pricing</a><a href="#help">Help</a>';
  expect(fireEvent.click(document.querySelector('a')!)).toBe(false);
  fireEvent.click(document.querySelectorAll('a')[1]);
  expect(confirm).toHaveBeenCalledTimes(1);
});
it('removes the warning after work is saved', () => {
  const view = renderHook(({ dirty }) => useUnsavedStudio(dirty, 'Unsaved'), {
    initialProps: { dirty: true },
  });
  view.rerender({ dirty: false });
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(false);
});
