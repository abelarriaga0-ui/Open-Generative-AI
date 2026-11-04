// Single paid-research call; deterministic delivery safety at zero extra API cost.
// Product appearance is an immutable commercial asset, not creative inspiration.
import {normalizeProductGeometry} from './product-geometry.js';

const text=v=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();

export function spokenOnly(value){
  // Stage directions accidentally spoken by Veo/Seedance create poor ads.
  // Retain the actual CTA words, but remove surrounding production metadata.
  return text(value)
    .replace(/\b(?:r[oó]tulo\s*(?:final)?|texto\s*(?:final)?\s*(?:en\s*pantalla)?|cartela\s*(?:final)?|overlay\s*(?:final)?|subt[ií]tulo\s*(?:final)?)\s*:\s*[«“"]?([^»”"]+)[»”"]?/gi,(_all,words)=>text(words))
    .replace(/[«»“”]/g,'')
    .replace(/\s+([.!?,;:])/g,'$1')
    .replace(/\s+/g,' ')
    .trim();
}
export function spokenCta(value){
  return spokenOnly(value).replace(/^(?:cta\s*:\s*)/i,'').trim();
}

export function productIdentityLock(info={}){
 const product=text(info.product||info.productName||'el producto').slice(0,120);
 const g=normalizeProductGeometry(info.productGeometry);
 const pieces=(g?.products||[]).map((x,i)=>
   'ITEM '+(i+1)+': '+text([x.name,x.container_type,x.body_shape,x.closure_type,x.main_colors].filter(Boolean).join(' / ')).slice(0,330)).join(' ');
 const imageRole=info.capabilities?.imageRole||'product_reference';
 const reference=info.imageProvided!==false;
 return [
   'P0 / IMMUTABLE PRODUCT SKU: '+product+'. THIS IS A REAL SKU, NOT A GENERIC PRODUCT INSPIRED BY A PHOTO.',
   reference
    ?'The uploaded product photograph is the visual source of truth for EVERY on-screen product. Treat it like a locked photography asset. Do not redesign, rebrand, reinterpret, substitute, beautify or invent a similar-looking bottle or carton.'
    :'No authenticated reference photo provided. Avoid invented label graphics; do not claim exact visual identity.',
   'MATCH PER FRAME: identical bottle and box silhouette, cap/dropper geometry, real material and gloss, relative size, label background, wordmark letter shapes and spacing, orientation, line breaks, contrast and printed artwork. Printed packaging must remain the SAME SKU, not a new logo, wrong spelling, generic symbol or a second invented bottle. Keep correct hand scale and stable geometry across cuts.',
   'PACKAGE MAP: '+(pieces||'Follow the supplied reference image and seller product name, with no speculative packaging.'),
   reference&&imageRole==='product_reference'
    ?'IMAGE ROLE: identity/reference conditioning; the uploaded photograph is not the opening frame. Create a new real-life set but preserve the product itself exactly.'
    :reference&&imageRole==='start_frame'
      ?'IMAGE ROLE: source photo may be the first frame if this model requires it; never falsely claim independent reference control.'
      :'IMAGE ROLE: no verified product-reference slot. Do not claim this endpoint can reproduce labels accurately.',
   'COMPOSITION FIRST: when small letters cannot be rendered faithfully, use a slightly wider, well-focused realistic product shot rather than a fake readable close-up. No generated subtitles, captions, text banners, animated slogans or fake wordmarks. A CTA must be SPOKEN in voiced ads, not inserted as instructions to the actor. Make product visibly identifiable when its name is spoken; preserve its genuine physical appearance over decorative effects.'
 ].join(' ');
}

export const RESEARCH_DELIVERABLE_CONTRACT=[
 'CRITICAL SALES COPY OUTPUT: spoken_script and script contain ONLY literal human speech, never camera cues, labels such as «Rótulo final:», «Texto en pantalla:», «CTA:», editing directions, bullet labels or quotation marks intended for an overlay. For example the allowed spoken CTA is «Pídelo por mensaje», never «Rótulo final: Pídelo por mensaje». The field cta contains only the customer buying action, not a visual production instruction.',
 'P0 PRODUCT PHOTO AUTHORITY: transcribe a legible brand exactly when visible and describe the original label and carton in product_visual_geometry; protect font orientation, wordmark, ink contrast, geometry, printed art, closure and relative sizes. The seller names the SKU, the photograph fixes the physical look. NEVER ask the video model to create an alternative logo, to enhance the packaging, to invent text or to replace the photographed real item. When photographic text may fail, direct the camera to a believable medium shot rather than invent readable package lettering. The commercial must show the real product when it is mentioned.',
 'COMMERCIAL EDITOR SELF-CHECK: actor first-frame motion and spoken hook agree, tangible customer tension, practical solution, original product reveal, grounded benefit, one explicit spoken CTA at the finish. Different brands, target customers and sales angles yield different decisions; do not copy a fragrance date-night scenario for unrelated goods. The durations and number of actions must remain achievable; avoid contradictory micro-scenes.'
].join(' ');
