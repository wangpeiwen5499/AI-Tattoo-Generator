export const CASE_ASSET_ROOT = '/imgs/cases/geometric-wolf';

export const CASE_PROMPT =
  'A symmetrical black-and-grey geometric wolf head tattoo, front-facing, with calm piercing eyes and a strong silhouette. Bold clean outlines, angular polygon facets, fine dotwork shading, and balanced negative space. A subtle circular geometric frame behind the wolf. Medium-sized vertical composition, highly readable on skin, professional tattoo stencil style. Black and grey ink only, no lettering, no scenery, no extra animals.';

// Anatomical left/right, not the viewer's left/right.
export const CASE_PLACEMENTS = [
  { id: 'left-arm', label: 'leftArm' },
  { id: 'right-arm', label: 'rightArm' },
  { id: 'shoulder', label: 'shoulder' },
  { id: 'calf', label: 'calf' },
] as const;

export type CasePlacement = (typeof CASE_PLACEMENTS)[number]['id'];

/** Homepage guided example: an uploaded Gundam design placed on the biceps. */
export const GUNDAM_CASE_ROOT = '/imgs/cases/gundam-biceps';

/**
 * The Gundam design was uploaded by the user (uploads are free). It must be
 * presented as an uploaded reference, never as an on-site generation.
 */
export const GUNDAM_DESIGN_NOTE = {
  zh: '该图案由用户上传（上传免费），不是网站现场生成的结果。网站生成设计需要另耗积分。',
  en: 'This design was uploaded by the user (uploads are free); it was not generated on this site. Generating a design on the site costs credits separately.',
} as const;
