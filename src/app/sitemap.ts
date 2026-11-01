import type { MetadataRoute } from 'next';

import { envConfigs } from '@/config';
import { defaultLocale, locales } from '@/config/locale';
import { tattooGuidePaths } from '@/config/seo/guide-paths';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = envConfigs.app_url.replace(/\/$/, '');
  return locales.flatMap((locale) =>
    ['', '/studio', '/pricing', '/blog', ...tattooGuidePaths].map((path) => ({
      url: `${base}${locale === defaultLocale ? '' : `/${locale}`}${path || '/'}`,
      alternates: {
        languages: Object.fromEntries(
          locales.map((lang) => [
            lang,
            `${base}${lang === defaultLocale ? '' : `/${lang}`}${path || '/'}`,
          ])
        ),
      },
    }))
  );
}
