'use client';

import { signOut, useSession } from '@/core/auth/client';

export function AccountNavigation({ locale }: { locale: string }) {
  const { data } = useSession();
  const zh = locale === 'zh';
  const prefix = zh ? '/zh' : '';
  if (!data?.user)
    return (
      <a
        className="site-nav-link site-account"
        href={`${prefix}/sign-in?callbackUrl=${encodeURIComponent(`${prefix}/generate`)}`}
      >
        {zh ? '登录' : 'Sign in'}
      </a>
    );
  return (
    <details className="site-account-menu">
      <summary className="site-nav-link">{zh ? '账户' : 'Account'}</summary>
      <div className="site-account-panel">
        <a href={`${prefix}/settings/profile`}>
          {zh ? '账户设置' : 'Account settings'}
        </a>
        <a href={`${prefix}/settings/credits`}>
          {zh ? '积分记录' : 'Credit history'}
        </a>
        <a href={`${prefix}/settings/payments`}>
          {zh ? '购买记录' : 'Purchases'}
        </a>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            window.location.assign(prefix || '/');
          }}
        >
          {zh ? '退出登录' : 'Sign out'}
        </button>
      </div>
    </details>
  );
}
