/** Basic text screening, not image moderation or proof of a subject's consent. */
export function isProhibitedImagePrompt(prompt: string): boolean {
  const text = prompt.normalize('NFKC').replace(/[\u200B-\u200D\uFEFF]/g, '');
  return [
    /\b(?:nudif(?:y|ication)|undress(?:ing)?|deepfake\s+porn|pornograph\w*|non[-\s]?consensual\s+(?:intimate|nude|sexual))\b/i,
    /\b(?:remove|take\s+off|strip\s+off)\b.{0,40}\b(?:clothes|clothing|underwear|bra|panties)\b/i,
    /\b(?:make|render|show)\b.{0,30}\b(?:her|him|them|person|woman|man)\b.{0,20}\b(?:naked|nude)\b/i,
    /(?:脱光|脱掉.{0,8}(?:衣|内衣|裤)|去掉.{0,8}(?:衣服|内衣)|去衣|裸化|色情|淫秽|未经同意.{0,8}(?:私密|裸照))/u,
  ].some((rule) => rule.test(text));
}

export const IMAGE_SAFETY_ERROR =
  'This request is not allowed. TattooVis prohibits nudification, sexualized edits and non-consensual intimate imagery. Use only photos you have permission to edit.';

export const TATTOO_RENDER_SAFETY =
  'Create only a non-sexual tattoo preview. Preserve all clothing and body coverage in the original photo. Do not remove clothing, expose intimate areas, or sexualize the person.';
