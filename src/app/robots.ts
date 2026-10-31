import { MetadataRoute } from 'next';

import { envConfigs } from '@/config';

export default function robots(): MetadataRoute.Robots {
  const appUrl = envConfigs.app_url;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/*?*q=',
        '/privacy-policy',
        '/terms-of-service',
        '/settings/*',
        '/activity/*',
        '/admin/*',
        '/api/*',
        '/verify-email',
        '/zh/verify-email',
        '/history',
        '/history/*',
        '/zh/history',
        '/zh/history/*',
      ],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
