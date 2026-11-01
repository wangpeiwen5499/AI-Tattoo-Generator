import guides from './tattoo-guides.json';

/** Snapshot of the Preview-rendered articles; copy is intentionally unchanged. */
export function getTattooGuides(locale: string) {
  return guides[locale === 'zh' ? 'zh' : 'en'];
}

export function getTattooGuide(slug: string, locale: string) {
  return getTattooGuides(locale).find((guide) => guide.slug === slug);
}
