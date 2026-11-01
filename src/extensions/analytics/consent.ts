export const CONSENT_KEY = 'tattoovis.analytics-consent';
export const CONSENT_EVENT = 'tattoovis:cookie-settings';
export const GA_MEASUREMENT_ID = 'G-31WBKE6C8Z';
export type AnalyticsConsent = 'analytics' | 'necessary';
export function parseAnalyticsConsent(
  raw: string | null
): AnalyticsConsent | null {
  try {
    const value = JSON.parse(raw || 'null');
    return value?.version === 1 &&
      ['analytics', 'necessary'].includes(value.choice)
      ? value.choice
      : null;
  } catch {
    return null;
  }
}
export function readAnalyticsConsent(
  storage: Pick<Storage, 'getItem'>
): AnalyticsConsent | null {
  try {
    return parseAnalyticsConsent(storage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}
export function persistAnalyticsConsent(choice: AnalyticsConsent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ version: 1, choice }));
  } catch {
    /* Choice remains valid for this visit if storage is unavailable. */
  }
}
// Only known public route names are reported. IDs, user-entered slugs, queries and fragments never cross this boundary.
const publicRoutes = new Set([
  'studio',
  'pricing',
  'gallery',
  'designs',
  'tattoo-ideas',
  'blog',
  'showcases',
  'history',
  'settings',
  'activity',
  'sign-in',
  'sign-up',
  'forgot-password',
  'reset-password',
  'verify-email',
  'privacy-policy',
  'terms-of-service',
  'acceptable-use',
  'generate',
]);
const publicGuideSlugs = new Set(['minimalist', 'geometric', 'first-tattoo']);
export function sanitizedPage(pathname: string, origin: string) {
  const clean =
    pathname.startsWith('/') && !pathname.startsWith('//')
      ? pathname.split(/[?#]/)[0]
      : '/';
  const parts = clean.split('/').filter(Boolean);
  const locale = parts[0] === 'zh' || parts[0] === 'en' ? parts.shift() : null;
  const route = parts[0] && publicRoutes.has(parts[0]) ? parts[0] : '';
  const guide =
    route === 'tattoo-ideas' && publicGuideSlugs.has(parts[1]) ? parts[1] : '';
  const page_path = `/${[locale, route, guide].filter(Boolean).join('/')}`;
  return {
    page_path,
    page_location: `${new URL(origin).origin}${page_path}`,
    page_title: 'Tattoo Studio',
    page_referrer: '',
  };
}
export function removeAnalyticsCookies(
  doc: Document = document,
  location: Location = window.location
) {
  const names = doc.cookie
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter((name) => /^_ga(?:_|$)/.test(name));
  const host = location.hostname;
  const labels = host.split('.');
  const domains = [
    '',
    host,
    `.${host}`,
    ...labels
      .slice(1, -1)
      .map((_, index) => `.${labels.slice(index + 1).join('.')}`),
  ];
  const paths = [
    '/',
    ...location.pathname
      .split('/')
      .filter(Boolean)
      .map((_, index, all) => `/${all.slice(0, index + 1).join('/')}`),
  ];
  for (const name of names)
    for (const domain of domains)
      for (const path of paths) {
        doc.cookie = `${name}=; Max-Age=0; path=${path}${domain ? `; domain=${domain}` : ''}; SameSite=Lax`;
      }
}
