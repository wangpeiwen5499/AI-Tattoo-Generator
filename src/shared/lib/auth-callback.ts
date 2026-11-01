export function safeAuthCallback(value?: string, locale = 'en'): string {
  let path = value || '/studio';
  try {
    const decoded = decodeURIComponent(path);
    if (
      !path.startsWith('/') ||
      decoded.startsWith('//') ||
      /[\\\x00-\x1f]/.test(decoded) ||
      new URL(path, 'https://callback.local').origin !==
        'https://callback.local'
    )
      path = '/studio';
  } catch {
    path = '/studio';
  }
  if (locale === 'zh' && !/^\/(en|zh)(\/|\?|$)/.test(path)) path = `/zh${path}`;
  return path;
}
export function emailVerificationUrl(
  email: string,
  callbackUrl = '/studio',
  sent = false
): string {
  const query = new URLSearchParams({ email, callbackUrl });
  if (sent) query.set('sent', '1');
  return `/verify-email?${query}`;
}
