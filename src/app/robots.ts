import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';

export default function robots(): MetadataRoute.Robots {
  const appUrl = envConfigs.app_url.replace(/\/$/, '');
  if (process.env.VERCEL_ENV === 'preview')
    return { rules: { userAgent: '*', disallow: '/' } };

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*?*q=',
        '/api/*',
        '/try-on-lab/',
        ...locales.flatMap((locale) =>
          [
            '/settings',
            '/activity',
            '/admin',
            '/history',
            '/auth/',
            '/verify-email',
            '/sign-in',
            '/sign-up',
            '/forgot-password',
            '/reset-password',
          ].map(
            (path) => `${locale === defaultLocale ? '' : `/${locale}`}${path}`
          )
        ),
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
