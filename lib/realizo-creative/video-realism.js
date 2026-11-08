// Single-request, model-agnostic creative quality contract for Realizo.
// This is editorial guidance, not proof the rendered frames or audio passed QA.
// Pricing and paid generation must call this SAME function with the SAME context.
export const VIDEO_REALISM_MARKER='REALIZO_REALISM_STANDARD v1';
export const VIDEO_CONTINUITY_MARKER='REALIZO_VISUAL_CONTINUITY_V2';
export const VIDEO_VOICE_MARKER='REALIZO_VOICE_CONTINUITY_V2';
export const VIDEO_FILM_FX_MARKER='REALIZO_INTENTIONAL_FILM_FX_V2';

export const VIDEO_REALISM_RULE=
  VIDEO_REALISM_MARKER+': Make every frame look genuinely filmed, not AI-rendered. Preserve real packaging materials, including plastic when the product is actually plastic, without invented synthetic gloss. True surface grain, natural highlights, believable gravity, shadows and camera movement. No waxy skin, airbrushed faces, CGI reflections, unintended floating objects, melting labels, morphing shapes or impossible liquid behavior. Keep product identity and shot continuity stable.';

// Keep the original short rule in director prompts to protect storyboard,
 // exact dialogue and provider budgets; add this detailed check at quote/generate.
export const VIDEO_CONTINUITY_RULE=
  VIDEO_CONTINUITY_MARKER+
  ': Keep original cap/dropper/dispenser, label, package scale, actor, wardrobe, hands and props stable through all cuts. Nothing spontaneously appears, disappears or floats; plausible supports, grip, contact shadows and liquid physics. Show the filmed action when its phrase is spoken. Never invent an extra part or replace the SKU.';

export const VIDEO_VOICE_RULE=
  VIDEO_VOICE_MARKER+
  ': VOICED VIDEO ONLY: Start understandable speech at the opening hook (within about 0.2s), maintain intelligible narration/dialogue across visual cuts and product inserts, and finish the approved spoken CTA near the end. No unexplained mute intervals, dropped words, long dead-air gaps, robotic syllables, rushed endings or overlapping unintelligible speakers. Keep one consistent speaker/accent unless the approved story requires distinct speakers; articulate every authorized word in order, at a natural pace. Keep music/foley quieter than speech; avoid audio cuts at scene boundaries. Natural breaths are allowed. If the selected model does not support native voice, do not invent or claim working speech.';

export const VIDEO_FILM_FX_RULE=
  VIDEO_FILM_FX_MARKER+
  ': PREMIUM/CINEMATIC PRODUCT-ONLY EXCEPTION: Artistic smoke, particles, impossible camera transitions or deliberate levitation MAY appear only when expressly requested in the approved creative direction. Treat them as intentional cinematic VFX, not accidental physics errors. Even during surreal effects keep the real package, closure, original label, geometry, material and scale unchanged; never add people or hands to a product-only scene.';

const silenceLock=/(?:ABSOLUTE NO-VOICE AUDIO LOCK|\bAUDIO NO_VOICE\b|\bAUDIO NO-VOICE\b|\bno spoken words\b|\bsin voz\b|\bno voice\b|\bno narration\b|\binstrumental only\b)/i;
const talking=/\b(?:spoken script|exact spoken script|approved narration|mandatory narration|voiceover|voice-over|narrat(?:ion|or)|dialogue|lip.sync|talking to (?:the )?camera|speaks to (?:the )?camera|talks to (?:the )?lens|habla a (?:la )?c[aá]mara|voz en off|di[aá]logo|habla al espectador|guion hablado)\b/i;
function voicedInput(prompt,context){
  if(context?.creative_style==='ugc')return true; // UGC speaks even when film audio selector is unused.
  if(context?.creative_style==='premium'||context?.creative_style==='cinematic')
    return context.audio_mode==='voiceover'||context.audio_mode==='dialogue';
  return !silenceLock.test(prompt)&&talking.test(prompt);
}
function fxEligible(context){
  return (context?.creative_style==='premium'||context?.creative_style==='cinematic') &&
    context.cast_mode==='product_only';
}

export function applyRealismToVideoInput(input,{creativeContext=null}={}){
  if(!input||typeof input!=='object'||Array.isArray(input)||
      typeof input.prompt!=='string'||!input.prompt.trim())return input;
  const prompt=input.prompt;
  const additions=[];
  if(!prompt.includes(VIDEO_REALISM_MARKER))additions.push(VIDEO_REALISM_RULE);
  if(!prompt.includes(VIDEO_CONTINUITY_MARKER))additions.push(VIDEO_CONTINUITY_RULE);
  if(voicedInput(prompt,creativeContext)&&!prompt.includes(VIDEO_VOICE_MARKER))
    additions.push(VIDEO_VOICE_RULE);
  if(fxEligible(creativeContext)&&!prompt.includes(VIDEO_FILM_FX_MARKER))
    additions.push(VIDEO_FILM_FX_RULE);
  if(!additions.length)return input;
  // Never truncate an approved script or provider prompt to fit a limit.
  const enhanced=additions.join(' ')+' '+prompt;
  if(enhanced.length>20000)throw new Error('invalid_generation_request');
  return {...input,prompt:enhanced};
}
