// Universal physical-photography standard for all Realizo video styles.
// Keep it concise so it survives provider prompt limits and style-specific rules.
// This is prompt guidance, not a guarantee that the provider renders perfectly.
export const VIDEO_REALISM_MARKER='REALIZO_REALISM_STANDARD v1';
export const VIDEO_REALISM_RULE=
  VIDEO_REALISM_MARKER+': Make every frame look genuinely filmed, not AI-rendered. Preserve real packaging materials, including plastic when the product is actually plastic, without invented synthetic gloss. True surface grain, natural highlights, believable gravity, shadows and camera movement. No waxy skin, airbrushed faces, CGI reflections, floating objects, melting labels, morphing shapes or impossible liquid behavior. Keep product identity and shot continuity stable.';

export function applyRealismToVideoInput(input){
  if(!input || typeof input!=='object' || Array.isArray(input) ||
      typeof input.prompt!=='string' || !input.prompt.trim())return input;
  if(input.prompt.includes(VIDEO_REALISM_MARKER))return input;
  const prompt=VIDEO_REALISM_RULE+' '+input.prompt;
  if(prompt.length>20000)throw new Error('invalid_generation_request');
  return {...input,prompt};
}
