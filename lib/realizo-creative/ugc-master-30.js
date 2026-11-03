// Master template of Realizo's 2026-10-31 Muapi image-reference generation.
// This is a PROMPT template, not a video-edit request. Keep structural instructions
// unchanged; adapt only product facts, packaging geometry, dialogue, and explicit
// customer overrides. Muapi is stochastic; no pixel-identical output is promised.
import {productGeometryPrompt,normalizeProductGeometry} from './product-geometry.js';
import {VIDEO_REALISM_RULE} from './video-realism.js';
import {voiceBudget} from './sales-storyboard.js';

const clean=(x,max)=>String(x??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const UGC_MUAPI_30_ID='ugc-vendedor';
export const UGC_MUAPI_30_DURATION=30;
export const UGC_MUAPI_30_MODEL='seedance-2.5-intl-omni-reference';
export const UGC_MUAPI_30_REFERENCE_TASK='reference';

export function buildLockedUgc30Prompt(info={}){
  if(Number(info.duration)!==30)throw Error('template_requires_30_seconds');
  const actorInput=clean(info.templateActor||'hombre',30);
  const setting=clean(info.templateSetting||'auto',120);
  const changes=clean(info.templateChangeRequest||'',350);
  const actor=/\b(?:una\s+)?mujer\b/i.test(changes)?'mujer':actorInput;
  const name=clean(info.product,100);
  const description=clean(info.sellerDescription,320);
  // This is a 30-second locked master; never silently cut a longer script
  // and accidentally remove the final spoken CTA.
  const sourceSpeech=String(info.voice??'').replace(/\\s+/g,' ').trim();
  if(sourceSpeech.length>950)throw Error('locked_template_spoken_script_too_long');
  const speech=sourceSpeech;
  if(!name||!description||!speech)throw Error('incomplete_locked_template');
  const geometry=productGeometryPrompt(info.productGeometry);
  const spokenWords=speech.split(/\s+/).filter(Boolean).length;
  const budget=voiceBudget(30,'ugc');
  const blocks=[
    'COMMERCIAL AD, realistic live-action vertical 9:16. Conversion story, NOT silent product animation or slideshow. '+VIDEO_REALISM_RULE,
    'TOP-PRIORITY AUDIO DIRECTOR: Begin speaking in the first 0.2 seconds; deliver every authorized line with energetic, naturally connected Spanish at a brisk, intelligible sales cadence. Voice covers 90-98% of runtime, until the last 0.2 seconds including the spoken CTA. No dead air, music-only intro/outro, slow drawn-out phrases, dramatic pauses, speech gaps longer than 0.25 seconds or mute cutaways. Keep tiny natural breaths and the original exact words, do not invent dialogue.',
    'MANDATORY AUDIO LANGUAGE: Spanish. All dialogue, narration and spoken CTA must be in Spanish.',
    'NMF SALES STORY: Hook hablado fuerte -> explica el problema del comprador y su impacto -> plantea claramente la solución -> presenta el producto como la manera de ejecutar ESA solución -> demuestra un uso/beneficio documentado -> CTA pronunciado hasta el final. Voz en el 90-98% del clip, insertos con voz constante. No catálogo, relleno, silencio ni testimonio inventado.',
    'SECOND-BY-SECOND SELLING PLAN (30s): 0-3s HOOK HABLADO | 3-9.2s PROBLEMA/DESEO Y EXPLICACIÓN DE SOLUCIÓN | 9.2-17.9s PRODUCTO VINCULADO A ESA SOLUCIÓN | 17.9-24.3s USO/BENEFICIO | 24.3-30s CTA HABLADO, with benefits and clear buying action continuing through the closing seconds. All shots serve these beats; continue speech over inserts.',
    'PRODUCT: '+name+'. Seller description: '+description+'.',
    'SPOKEN SCRIPT (Spanish, target market '+clean(info.market||'EC',12)+'): "'+speech+'". EXACT sales dialogue, from initial hook to final CTA, not a silent montage. Lip-sync only when model supports native speech.',
    'REFERENCE IMAGE: Use the uploaded product photograph ONLY as an identity/appearance reference. This is NOT the first frame. Build a NEW photorealistic scene with human actor and environment from scratch.',
    geometry,
    'HOOK TIMING — HARD EDITORIAL RULE: First 0-3s maximum; 3 seconds is the absolute maximum, then advance to buyer problem/desire and product solution. Stop the scroll at frame one; no logo intro or silent establishing shot.',
    'UGC SALES REVIEW: natural direct-to-camera review-style sales presentation. Face and speaking performance visible 70-85% of runtime; never fake a personal testimonial. VOICE-FIRST EDITING: voice NEVER stops for cutaways. Phone-native jump cuts, no glossy cinematic transitions.',
    'FORMAT CONTRACT UGC: Hook hablado específico → situación real → presentación informada → demostración breve → beneficio verificable → objeción útil → CTA hablado.',
    'CAMERA: Video vertical desde teléfono de un creador adulto, encuadre cercano, mirada a lente, piel con textura natural, micromovimientos de mano, ritmo conversado.',
    'STYLE-SPECIFIC POSTPRODUCTION & FINISHING: EDITING: Montaje nativo de creador: cortes al ritmo del habla, jump cuts discretos, una breve toma de apoyo, sin efecto publicitario que rompa la espontaneidad. TRANSITIONS: Corte directo casi siempre, jump-cut justificado para eliminar pausas; no whip pan, flash ni transiciones de cine de estudio. EFFECTS: Corrección natural de piel, exposición y color; nada de piel plástica, lens flares, partículas o motion graphics excesivos. SOUND DESIGN: Voz humana clara y continua, sonido ambiente auténtico y música baja sin tapar las palabras. Edits must support story, physical realism and purchase motive; they are generator directions, not separately guaranteed editing.',
    'SPEECH DENSITY: target '+budget.target+' words for 30s, permitted range '+budget.minimum+'-'+budget.maximum+'. This exact script has '+spokenWords+' words. Keep a bright, clear, brisk natural rhythm, voice continuous across visuals, no drawn-out vowels or gaps, and finish the spoken CTA at the video end. Never add or invent unscripted lines.',
    'SALES ANGLE: '+clean(info.angle||'product benefit',120)+'. PURCHASING MOTIVE: '+clean(info.buyerMotive||'Use the product in a real everyday context.',230)+'.',
    'LOCKED TEMPLATE RULE: Preserve every instruction and all five time segments above. Adapt ONLY product identity, its observed packaging, justified usage, real benefits, spoken script and market CTA. Do not freely redesign setting, person, camera, audio or scene structure.',
    'DEFAULT CREATOR: '+(actor==='mujer'?'adult woman':actor==='hombre'?'adult man':'adult male creator')+'. DEFAULT SETTING: '+(setting==='auto'?'real home bathroom, everyday lighting':setting)+'.',
    ...(changes?['EXPLICIT CUSTOMER CHANGE REQUEST: '+changes+'. Apply ONLY the explicitly requested differences; every unrelated master-template element remains unchanged.']:[]),
  ];
  // Keep complete mandatory sections. Never silently truncate the prompt to a
  // partial word or a dangling "RE"; excessive input is reported before charge.
  let prompt=blocks.join(' ');
  if(prompt.length>5400){
    // Preserve ALL structural beats; compact product geometry rather than
    // truncating the ending of the prompt sent to Muapi.
    const observed=normalizeProductGeometry(info.productGeometry);
    const bottles=(observed?.products||[]).map(p=>
      [p.name,p.container_type,p.body_shape,p.closure_type,p.main_colors].filter(Boolean).join(' / ')).join('; ');
    const ratios=(observed?.relative_pairs||[]).map(p=>
      p.larger+' visibly larger than '+p.smaller+
      (p.same_depth&&p.apparent_height_ratio?' ('+p.apparent_height_ratio+'x apparent height)':'')).join('; ');
    blocks[8]='PRODUCT PACKAGING GEOMETRY — HIGH PRIORITY: '+(bottles||'Use the uploaded photo as packaging identity.')+
      '. '+ratios+'. Keep logos, bottle shape, cap and label unchanged; correct hand grip and physical scale.';
    prompt=blocks.join(' ');
  }
  if(prompt.length>5400){
    // Retain the locked five-beat story and spoken script; compact only the
    // optional finishing prose to fit the model's existing prompt ceiling.
    const finishing=blocks.findIndex(b=>b.startsWith('STYLE-SPECIFIC POSTPRODUCTION'));
    if(finishing>=0)blocks[finishing]=
      'STYLE-SPECIFIC POSTPRODUCTION: Authentic phone-video cuts and exposure, tactile sound, continuous clear dialogue and natural skin pores. No airbrushed/waxy faces, invented high-gloss materials, floating product, morphing packaging or CGI beauty effects.';
    prompt=blocks.join(' ');
  }
  if(prompt.length>5400)throw Error('locked_template_prompt_too_long');
  return prompt;
}
