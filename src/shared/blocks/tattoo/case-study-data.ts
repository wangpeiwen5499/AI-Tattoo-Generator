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
