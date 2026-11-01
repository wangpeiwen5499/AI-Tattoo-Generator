import guides from './tattoo-guides.json';

/** Localized tattoo design guides shared by article pages and navigation cards. */
export function getTattooGuides(locale: string) {
  return guides[locale === 'zh' ? 'zh' : 'en'];
}

export function getTattooGuide(slug: string, locale: string) {
  return getTattooGuides(locale).find((guide) => guide.slug === slug);
}
