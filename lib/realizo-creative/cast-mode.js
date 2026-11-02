// Customer choice for non-UGC film direction. This changes the creative plan,
// never provider endpoints, billing, or image-reference identity rules.
export const CAST_MODES=Object.freeze(['product_only','with_people']);
export function normalizeCastMode(value){
  return CAST_MODES.includes(value)?value:'with_people';
}
export function isFilmStyle(style){
  return style==='premium'||style==='cinematic';
}
export function castDirection(style,mode){
  if(!isFilmStyle(style))return '';
  if(normalizeCastMode(mode)==='product_only')return [
    'CAST CONTRACT: PRODUCT ONLY. No people, no faces, no hands, no silhouettes,',
    'no reflections of people, no crowds, no mannequins and no human speech to camera.',
    'Make a high-budget photographed product film: real lenses, controlled studio',
    'or location lighting, elegant physical camera movement, macro texture,\n    'in-camera match cuts and precisely timed commercial product details.',
    'The product is the only protagonist. A single-shot option means ONE continuous',
    'moving camera shot with no cuts; multiple shots means distinct premium inserts.',
    'Do not substitute bottle spins, floating CGI or a static catalogue slideshow.'
  ].join(' ');
  return [
    'CAST CONTRACT: PRODUCT WITH PEOPLE. Human actor(s) may model, wear, apply',
    'or naturally interact with the real product in a professionally lit cinematic scene.',
    'They NEVER speak to the lens, film a selfie, review the item or act as UGC presenters.',
    'Build an aspirational visual microstory driven by gestures, movement and product use.',
    'For a fragrance, a poised adult may walk through a city while other adult extras',
    'briefly notice their presence as a fictional cinematic social cue; this is not',
    'proof of attraction, pheromones or a guaranteed product effect.',
    'For fashion show fit, fabric, motion and setting; for cosmetics show realistic',
    'application without inventing medically or cosmetically guaranteed results.',
    'A single-shot option is ONE continuous composed take; multi-shot is a motivated edit.'
  ].join(' ');
}
