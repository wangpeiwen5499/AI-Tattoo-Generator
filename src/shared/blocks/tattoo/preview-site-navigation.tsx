'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

import { previewNavigation } from '@/config/preview/navigation';

import { AccountNavigation } from './account-navigation';

export function PreviewSiteNavigation({
  locale,
  showAccount = false,
}: {
  locale: string;
  showAccount?: boolean;
}) {
  const pathname = usePathname();
  const nav = previewNavigation(locale);
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const path = pathname.replace(/^\/zh(?=\/|$)/, '') || '/';
  const languagePath = path === '/' ? '' : path;

  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [open]);

  return (
    <header
      className="site-navigation"
      data-menu-open={open}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <div className="site-navigation-inner">
        <a className="site-brand brand" href={nav.home} aria-label="TattooVis">
          <img src="/favicon.ico" alt="" width="28" height="28" />
          <span>TattooVis</span>
        </a>
        <button
          ref={toggle}
          className="site-menu-toggle"
          type="button"
          aria-controls="site-navigation-links"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? nav.close : nav.menu}
        </button>
        <nav
          id="site-navigation-links"
          className="site-navigation-links"
          aria-label={nav.label}
        >
          {nav.links.map((link) => (
            <a
              key={link.key}
              className="site-nav-link"
              href={link.href}
              aria-current={
                ['blog', 'pricing'].includes(link.key) &&
                path.startsWith(`/${link.key}`)
                  ? 'page'
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {showAccount && <AccountNavigation locale={locale} />}
          <div
            className="site-language"
            aria-label={locale === 'zh' ? '语言' : 'Language'}
          >
            <a
              href={languagePath || '/'}
              lang="en"
              aria-current={locale === 'en' ? 'true' : undefined}
            >
              EN
            </a>
            <span aria-hidden="true">/</span>
            <a
              href={`/zh${languagePath}`}
              lang="zh"
              aria-current={locale === 'zh' ? 'true' : undefined}
            >
              中文
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
