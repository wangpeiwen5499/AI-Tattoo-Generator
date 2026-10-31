export const tattooGuideSlugs = [
  'minimalist',
  'geometric',
  'first-tattoo',
] as const;
export const tattooGuidePaths = [
  '/tattoo-ideas',
  ...tattooGuideSlugs.map((slug) => `/tattoo-ideas/${slug}`),
];
