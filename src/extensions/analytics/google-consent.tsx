'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { usePathname } from 'next/navigation';

import {
  AnalyticsConsent,
  CONSENT_EVENT,
  CONSENT_KEY,
  parseAnalyticsConsent,
  persistAnalyticsConsent,
  readAnalyticsConsent,
  removeAnalyticsCookies,
  sanitizedPage,
} from './consent';
import styles from './google-consent.module.css';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}
const denied = {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
};
function setCollection(gaId: string, allowed: boolean, pathname: string) {
  const target = window;
  target[`ga-disable-${gaId}`] = !allowed;
  if (!allowed) {
    target.gtag?.('consent', 'update', denied);
    removeAnalyticsCookies();
    return;
  }
  const id = `tattoovis-ga-${gaId}`;
  if (!document.getElementById(id)) {
    target.dataLayer = target.dataLayer || [];
    target.gtag = function () {
      target.dataLayer!.push(arguments);
    };
    target.gtag('consent', 'default', denied);
    target.gtag('consent', 'update', {
      ...denied,
      analytics_storage: 'granted',
    });
    target.gtag('js', new Date());
    target.gtag('set', sanitizedPage(pathname, window.location.origin));
    // Deployment prerequisite: turn Enhanced measurement OFF for this GA4 web stream.
    // send_page_view:false alone does not suppress its history/form events:
    // https://developers.google.com/analytics/devguides/collection/ga4/views
    target.gtag('config', gaId, {
      ...sanitizedPage(pathname, window.location.origin),
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      ignore_referrer: true,
    });
    const script = document.createElement('script');
    script.id = id;
    script.dataset.gaConsent = 'accepted';
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`;
    document.head.appendChild(script);
  } else {
    target.gtag?.('consent', 'update', {
      ...denied,
      analytics_storage: 'granted',
    });
  }
}

function readSavedConsent(): AnalyticsConsent | null {
  try {
    return typeof window === 'undefined'
      ? null
      : readAnalyticsConsent(window.localStorage);
  } catch {
    return null;
  }
}
const subscribeHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function GoogleAnalyticsConsent({ gaId }: { gaId: string }) {
  const pathname = usePathname() || '/';
  const [choice, setChoice] = useState<AnalyticsConsent | null>(
    readSavedConsent
  );
  const ready = useSyncExternalStore(
    subscribeHydration,
    getClientSnapshot,
    getServerSnapshot
  );
  const [open, setOpen] = useState(() => !readSavedConsent());
  const lastPage = useRef<string | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const zh = pathname === '/zh' || pathname.startsWith('/zh/');
  useEffect(() => {
    const reopen = () => {
      returnFocus.current = document.activeElement as HTMLElement;
      setOpen(true);
      requestAnimationFrame(() => title.current?.focus());
    };
    const sync = (event: StorageEvent) => {
      if (event.key !== CONSENT_KEY && event.key !== null) return;
      const next = parseAnalyticsConsent(event.newValue);
      // Disable synchronously, before a rerender can emit another pageview.
      if (next !== 'analytics') setCollection(gaId, false, pathname);
      setChoice(next);
      setOpen(!next);
    };
    window.addEventListener(CONSENT_EVENT, reopen);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(CONSENT_EVENT, reopen);
      window.removeEventListener('storage', sync);
    };
    // Consent initialization is independent of navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gaId]);
  useEffect(() => {
    if (!ready) return;
    if (choice !== 'analytics') {
      setCollection(gaId, false, pathname);
      lastPage.current = null;
      return;
    }
    setCollection(gaId, true, pathname);
    const page = sanitizedPage(pathname, window.location.origin);
    if (lastPage.current === page.page_path) return;
    lastPage.current = page.page_path;
    const target = window;
    target.gtag?.('set', page);
    target.gtag?.('event', 'page_view', { ...page, send_to: gaId });
  }, [choice, gaId, pathname, ready]);
  const choose = (next: AnalyticsConsent) => {
    // Apply rejection immediately; do not wait for React effects.
    if (next === 'necessary') setCollection(gaId, false, pathname);
    persistAnalyticsConsent(next);
    setChoice(next);
    setOpen(false);
    returnFocus.current?.focus();
  };
  if (!ready || !open) return null;
  return (
    <section
      className={styles.banner}
      role="region"
      aria-label={zh ? 'Cookie 偏好设置' : 'Cookie preferences'}
    >
      <div className={styles.copy}>
        <h2 ref={title} tabIndex={-1}>
          {zh ? '由你决定是否允许统计 Cookie' : 'Your analytics cookie choice'}
        </h2>
        <p>
          {zh
            ? '必要 Cookie 用于登录和网站运行。只有你同意后，我们才会加载 Google Analytics，了解基本访问情况。拒绝统计不影响登录和创作。'
            : 'Necessary cookies keep sign-in and the site working. With your permission, Google Analytics measures basic site visits. Declining analytics does not affect sign-in or creating previews.'}{' '}
          <a href={zh ? '/zh/privacy-policy' : '/privacy-policy'}>
            {zh ? '隐私政策' : 'Privacy policy'}
          </a>
        </p>
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={() => choose('analytics')}>
          {zh ? '允许统计' : 'Accept analytics'}
        </button>
        <button type="button" onClick={() => choose('necessary')}>
          {zh ? '仅必要 Cookie' : 'Only necessary'}
        </button>
        {choice && (
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              returnFocus.current?.focus();
            }}
          >
            {zh ? '关闭' : 'Close'}
          </button>
        )}
      </div>
    </section>
  );
}

export function CookieSettingsButton() {
  const pathname = usePathname() || '/';
  return (
    <button
      type="button"
      className="text-muted-foreground hover:text-primary cursor-pointer text-xs underline"
      onClick={() => window.dispatchEvent(new Event(CONSENT_EVENT))}
    >
      {pathname === '/zh' || pathname.startsWith('/zh/')
        ? 'Cookie 设置'
        : 'Cookie settings'}
    </button>
  );
}
