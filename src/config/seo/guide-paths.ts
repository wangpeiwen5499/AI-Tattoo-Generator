export const tattooGuideSlugs = [
  'minimalist',
  'geometric',
  'first-tattoo',
] as const;
export const tattooGuidePaths = tattooGuideSlugs.map(
  (slug) => `/tattoo-ideas/${slug}`
);
