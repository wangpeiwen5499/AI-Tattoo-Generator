'use client';

import { useEffect } from 'react';

export function useUnsavedStudio(dirty: boolean, message: string) {
  useEffect(() => {
    if (!dirty) return;
    // A same-URL history entry lets Back stop before Next replaces the editor.
    // Preserve Next's history state and run before its bubble-phase listener.
    const marker = 'tattoovisUnsavedGuard';
    const editorUrl = location.href;
    const guardedState = { ...history.state, [marker]: true };
    if (!history.state?.[marker])
      history.pushState(guardedState, '', editorUrl);
    let leaving = false;
    const back = (event: PopStateEvent) => {
      if (leaving) return;
      event.stopImmediatePropagation();
      if (window.confirm(message)) {
        leaving = true;
        if (location.href === editorUrl) history.back();
        else
          window.dispatchEvent(
            new PopStateEvent('popstate', { state: event.state })
          );
      } else {
        history.pushState(guardedState, '', editorUrl);
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = (event.target as Element)?.closest?.('a');
      if (!link || link.target === '_blank' || link.hasAttribute('download'))
        return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      const destination = new URL(href, location.href);
      if (
        destination.origin === location.origin &&
        destination.pathname === location.pathname &&
        destination.search === location.search
      )
        return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    window.addEventListener('popstate', back, true);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      window.removeEventListener('popstate', back, true);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty, message]);
}
