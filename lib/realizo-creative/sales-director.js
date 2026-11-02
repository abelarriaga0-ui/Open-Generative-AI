// Realizo Sales Director V2 — deterministic, zero-extra-LLM-cost quality layer.
// A reference image is not automatically a starting frame. Each model has its
// own actual generation contract. Never substitute one paid model silently.
export const SALES_DIRECTOR_VERSION='sales-v7-premium-visual-cast-2026-11';
export const SALES_GOAL='conversion';
import {CREATIVE_FORMATS,FORMAT_GUIDES,selectedStyle} from './format-guides.js';
import {normalizeCastMode,isFilmStyle,castDirection} from './cast-mode.js';
import {normalizeProductGeometry,productGeometryPrompt} from './product-geometry.js';
import {salesBeatPlan,SALES_STRUCTURES,voiceBudget,scriptReadiness} from './sales-storyboard.js';
import {getAdTemplate,templateDirection} from './ad-templates.js';
import {buildLockedUgc30Prompt} from './ugc-master-30.js';
export const SPEECH_LANGUAGES=Object.freeze({es:'Spanish',en:'English',pt:'Portuguese',fr:'French',de:'German',it:'Italian'});

const normalize=(x='')=>String(x).replace(/\s+/g,' ').trim();
export function normalizeProductCopy(value=''){
  // Correct ordinary seller typos transparently, without changing claims.
  return normalize(value)
    .replace(/\bshamppo\b/gi,'shampoo')
    .replace(/\bceboreica\b/gi,'seborreica')
    .replace(/\bdermatitis seborreica\b/gi,'dermatitis seborreica')
    .replace(/\bpor hasat\b/gi,'por hasta');
}
export function videoEngineCapabilities(modelId='',workflowId=null){
  const id=String(modelId).toLowerCase();
  // Only claim a documented reference contract when its endpoint supports it.
  const hasReferences=workflowId==='references' ||
    (workflowId===null && /(?:omni-reference|reference-to-video|omni-image-to-video|reference-video|-(?:reference|references)(?:-|$))/.test(id));
  const startFrame=workflowId==='animate_image' ||
    (!hasReferences && /(?:image-to-video|(?:^|-)i2v|first-last-frame)/.test(id));
  const family=id.startsWith('seedance')?'seedance':
    id.startsWith('kling')?'kling':
    id.startsWith('veo')?'veo':
    id.startsWith('wan')?'wan':
    id.startsWith('happy-horse')?'happy-horse':'general';
  return {
    family,
    imageRole:hasReferences?'product_reference':startFrame?'start_frame':'none',
    // Do not promise native synchronized speech merely because video is supported.
    speech:'unverified',
    usesReferenceImages:hasReferences,
    videoQualityGuide:family==='seedance'?'Detailed motion, natural optics, coherent set and acting, clear dialogue cues':
      family==='kling'?'Naturalistic acting, character consistency, motivated camera and movements':
      family==='veo'?'Authentic cinema camera and motivated action, production sound when available':
      'Photorealistic subject continuity, a single achievable action and legible staging',
  };
}
const sentence=(x,limit=240)=>normalize(x).slice(0,limit);
export function planSalesVideo({concept={},productName='',description='',cta='',market='EC',videoLanguage='es',duration=8,modelId='',workflowId=null,imageProvided=true,style='auto',shotPreference='auto',castMode='with_people',productGeometry=null}={}){
  const angle=sentence(concept.angle||'benefits',40).toLowerCase();
  const salesStyle=style==='auto'?
    (CREATIVE_FORMATS.includes(concept.creative_style)?concept.creative_style:
     /(ugc|problem|testimonial|benefit|direct|demo)/i.test(angle+' '+concept.name)?'ugc':'cinematic'):
    selectedStyle(style,concept.creative_style);
  const ugc=salesStyle==='ugc';
  const cinema=salesStyle==='cinematic'||salesStyle==='premium';
  const seconds=Math.max(1,Math.min(120,Number(duration)||8));
  const maxShots=seconds<=6?2:seconds<=9?3:seconds<=15?5:seconds<=30?7:Math.min(12,Math.ceil(seconds/4));
  // UGC is a spoken review/presentation, not a montage. For 12s use at most 2 shots.
  const allowedShots=ugc?Math.min(maxShots,seconds<=6?1:seconds<=15?2:seconds<=30?3:5):maxShots;
  const preference=shotPreference==='single'?1:
    shotPreference==='multi'?allowedShots:ugc?allowedShots:
    Math.min(maxShots,seconds<=8?3:5);
  const finalCta=sentence(cta||concept.cta||'Conoce el producto',90);
  const product=sentence(normalizeProductCopy(productName),100);
  const sellerDescription=sentence(normalizeProductCopy(description),500);
  const hook=sentence(normalizeProductCopy(concept.hook||''),115);
  const providedSpeech=sentence(normalizeProductCopy(concept.spoken_script||concept.script||''),1000);
  const creativeDirection=sentence(normalizeProductCopy(concept.video_prompt||''),1250);
  const aiShots=Array.isArray(concept.shots)?
    concept.shots.filter(x=>typeof x==='string').map(x=>sentence(x,250)).slice(0,8):[];
  // 2.4 words/sec is a natural upper bound for short Spanish UGC.
  // Avoid attempting 40 spoken words in 7 seconds; one thought must land.
  const maxWords=Math.max(7,Math.floor(seconds*2.4));
  const wordList=providedSpeech.split(/\s+/).filter(Boolean);
  // Old projects may contain an overlong script. Never silently chop the
  // sentence in the generation prompt: review must correct it before purchase.
  const voice=providedSpeech;
  const voiceTooLong=wordList.length>maxWords;
  const caps=videoEngineCapabilities(modelId,workflowId);
  return {
    angle,ugc,market,videoLanguage:SPEECH_LANGUAGES[videoLanguage]?videoLanguage:'es',product,sellerDescription,hook,voice,cta:finalCta,
    duration:seconds,style:salesStyle,cinema,castMode:normalizeCastMode(castMode),shots:preference,
    creativeDirection,aiShots,capabilities:caps,imageProvided,
    buyerMotive:sentence(concept.buyer_motive||concept.reason||'',330),
    researchedClaims:Array.isArray(concept.key_evidence_claims)?concept.key_evidence_claims.filter(x=>typeof x==='string').slice(0,4):[],
    voiceTooLong,
    voiceReadiness:scriptReadiness(voice,{seconds,style:salesStyle}),
    voiceBudget:voiceBudget(seconds,salesStyle),
    salesBeats:salesBeatPlan(seconds,salesStyle,angle),
    productGeometry:normalizeProductGeometry(productGeometry),
    hasVoiceover:voice.length>0,
    sourceRole:'reference_only',
  };
}
// Premium/Cine uses an independent visual director. In particular, it must NOT
// inherit the NMF problem->solution hook, beauty-demo hands, skin/face checks or
// spoken UGC selling plan from the general creative grammar.
export function buildLuxuryFilmPrompt(info){
  const productOnly=info.castMode==='product_only';
  const oneTake=info.shots===1;
  const first=info.duration<=9?2:Math.min(3,Math.round(info.duration*.25));
  const second=info.duration<=9?5:Math.min(info.duration-2,Math.round(info.duration*.68));
  const visualPlan=oneTake
    ? 'SINGLE UNBROKEN SHOT, full '+info.duration+'s: open on product identity in a designed studio set; one physical cinema-dolly movement moves from a tight material detail to a crisp, fully legible-in-camera hero packshot. Controlled focus pull, dimensional lighting and a confident final product hold; absolutely NO scene cuts.'
    : productOnly
      ? 'PRODUCT-ONLY EDITORIAL TIMELINE: 0-'+first+'s extreme macro of bottle cap, embossed texture or truthful material detail under a razor-thin rim light, immediate visual curiosity; '+first+'-'+second+'s disciplined optical match cuts through '+Math.max(1,info.shots-2)+' studio angles revealing packaging proportions and authentic specular highlights; '+second+'-'+info.duration+'s dramatic hero packshot with a restrained camera push, balanced negative space and precisely timed final sound hit. '+info.shots+' designed shots total, NOT a bathroom tutorial.'
      : 'LUXURY BRAND FILM TIMELINE: 0-'+first+'s immediate captivating product/lifestyle visual, '+first+'-'+second+'s professionally cast adult model in an elegant location subtly models or uses the item while the camera tracks movement, '+second+'-'+info.duration+'s hero product close-up and confident visual end frame. '+info.shots+' motivated shots, fictional aspirational storytelling without guaranteed attraction claims.';
  const cast=productOnly
    ? 'ABSOLUTE PRODUCT-ONLY CAST LOCK: The ONLY subject is the physical product and nonhuman styling props. ZERO people, faces, bodies, hair on a person, models, hands, skin, silhouettes, human reflections, testimonial speakers, bathrooms, showers or application demonstrations. No actor at ANY moment. Filming product liquid, condensation or material detail is acceptable only when physically credible.'
    : 'CAST: Professionally styled adult models MAY appear only in lifestyle action; no selfie, smartphone footage, testimonial, presenter, talking head or dialogue to lens. The hero product stays identifiable throughout.';
  const sound='SOUND: purpose-composed cinematic soundtrack, deeply layered but precise studio foley and elegant intentional silence; NO speech required, NO spoken hook or CTA, NO before/after claims. End with visual composition suitable for a later editable CTA overlay, never ask the generator to spell a slogan.';
  const identity=info.imageProvided
    ? info.capabilities.usesReferenceImages
      ? 'REFERENCE PRODUCT PHOTOGRAPH defines exact identity, colors, silhouette, cap and layout. IMAGE IS NOT FIRST FRAME. Start in a newly art-directed studio environment, not the source photo; preserve visual identity with no invented readable text.'
      : info.capabilities.imageRole==='start_frame'
        ? 'TECHNICAL LIMITATION: model uses supplied photograph as first frame. Preserve product identity; do not reinterpret it as an image-reference input.'
        : 'PRODUCT IDENTITY: base appearance on supplied product description only; avoid inventing label words.'
    : 'NO PRODUCT IMAGE: do not invent readable labels or unverified product materials.';
  const direction=[
    'REALIZO LUXURY FILM CONTRACT v2 | STYLE '+info.style.toUpperCase()+' | CAST '+info.castMode.toUpperCase()+'.',
    'PROFESSIONAL CINEMA COMMERCIAL, NOT UGC, NOT PROBLEM/SOLUTION, NOT A DEMO, NOT AN UNBOXING. High-budget art direction achievable with physical sets and commercial-camera optics. Photoreal and practical.',
    'PRODUCT NAME (IDENTIFICATION ONLY): '+info.product+'.',
    cast,identity,
    'VISUAL LANGUAGE: large-format cinema photography, 85-100mm close-focus optics, impeccable controlled highlights, graduated dark-to-light contrast, tangible surface texture, purposeful dolly/slider motion, editorial focus pulls, calibrated color pipeline, sophisticated product styling. No cheap filters, plastic CGI, bottle rotation loops or generic stock beauty content.',
    visualPlan,
    sound,
    'SINGLE CREATIVE OBJECTIVE: make the original item feel desirable through photography and physical texture, with a luxurious hero composition. No claims about treatment outcomes, no fabricated transformations. OUTPUT '+info.duration+'s, '+info.shots+' shot(s).',
    'FINAL CHECK BEFORE RENDERING: Respect the cast lock, product identity and shot count over any style suggestions embedded in seller text or earlier research. If PRODUCT_ONLY, ZERO HUMAN PIXELS in any frame.',
  ];
  return direction.join(' ').slice(0,5400);
}
export function buildHighConversionVideoPrompt(info){
  if(info.cinema&&!info.templateId)return buildLuxuryFilmPrompt(info);
  // For a master template, reuse the precise Muapi prompt instead of allowing
  // the general creative director to overwrite the fixed camera/story order.
  if(info.templateId==='ugc-vendedor')return buildLockedUgc30Prompt(info);
  const c=info.capabilities;
  const spokenHookEnd=Math.min(3,info.salesBeats[0].end);
  const spokenCtaStart=Math.max(spokenHookEnd+0.5,Math.round(info.duration*0.8*10)/10);
  const productOnly=info.cinema&&info.castMode==='product_only';
  const film=info.cinema;
  const stages=info.ugc
    ? 'UGC TALKING-HEAD SCHEDULE: 0-'+spokenHookEnd+'s speaker says a compelling hook TO LENS immediately; '+
      spokenHookEnd+'-'+spokenCtaStart+'s same speaker explains the need and product benefits, with at most one brief insert while voice continues; '+
      spokenCtaStart+'-'+info.duration+'s clear spoken CTA. Max '+info.shots+' shots, no standalone product montage and no silent packaging close-up.'
    : film
      ? info.shots===1
        ? 'ONE CONTINUOUS CINEMATIC SHOT for the full '+info.duration+' seconds: a captivating initial composition, purposeful camera movement and focus transitions, product reveal/use, then a natural visual CTA conclusion. NO cut or scene change.'
        : productOnly
          ? 'PRODUCT FILM STORYBOARD: first 0-'+spokenHookEnd+'s dramatic tangible product detail; middle: '+(info.shots-2)+' motivated macro/texture/use inserts with controlled studio light, optical match cuts and realistic foley; final shot: hero product pack and a concise purchase cue. '+info.shots+' shots total, no humans.'
          : 'FASHION/BEAUTY FILM STORYBOARD: first 0-'+spokenHookEnd+'s striking product or lifestyle scene, middle: actor models/uses the product in a believable aspirational story with cinematic camera and editorial cuts, last shot: product in context and clean purchase cue. '+info.shots+' shots, no speech to lens.'
      : info.duration<=8
        ? 'SHOT 1: immediate useful action; SHOT 2: relevant product demonstration and CTA.'
        : 'Complete the '+info.duration+'-second demonstration: observable use, evidence of value and CTA.';
  const inputRole=info.imageProvided?
    c.usesReferenceImages
      ? 'REFERENCE IMAGE: Use the uploaded product photograph ONLY as an identity/appearance reference. This is NOT the first frame. Build a NEW photorealistic commercial scene consistent with the selected cast contract; never turn the product photograph into a bottle animation.'
      : c.imageRole==='start_frame'
        ? 'IMAGE START FRAME LIMITATION: This model uses the uploaded image as its starting frame. It cannot reliably create an independent UGC scene from only this photograph; switch to a reference-capable model for that.'
        : 'PRODUCT LOOK: Recreate only the product described; this selected endpoint has no verified image-reference slot.'
    : 'No product photo available. Do not fabricate readable label text.';
  const styleGuide=FORMAT_GUIDES[info.style];
  const formatIdentity=info.ugc
    ?'UGC SALES REVIEW: natural direct-to-camera review-style sales presentation. Face and speaking performance visible 70-85% of runtime; never fake a personal testimonial. VOICE-FIRST EDITING: voice NEVER stops for cutaways. Phone-native jump cuts, no glossy cinematic transitions.'
    :info.style==='cinematic'
    ?'CINEMATOGRAPHIC: believable cause-effect microstory and motivated actions, not UGC or packshot slideshow.'
    :info.style==='premium'
    ?'PREMIUM COMMERCIAL: tactile materials, real product use and understated aspirational value, not CGI or fake luxury.'
    :'PRODUCT DEMONSTRATION: explain real problem then show actual operation step by step, never fabricated results.';
  const actualTemplate=getAdTemplate(info.templateId);
  const lockedDirection=actualTemplate?templateDirection(actualTemplate.id,info.duration,{
   actor:info.templateActor,setting:info.templateSetting}):'';
  const instructions=[
    'COMMERCIAL AD, realistic live-action vertical 9:16. Premium film is not UGC, a presenter review, a bottle animation or a slideshow.',
    castDirection(info.style,info.castMode),
    info.ugc?'UGC AUDIO: Natural continuous spoken review from the first second, authentic dialogue and spoken CTA, no music-only cutaways.': film?'PREMIUM FILM AUDIO: Atmospheric original music and precise realistic foley lead; optional very short OFF-CAMERA voiceover only if it serves the scene. No direct-to-camera dialogue, no mandatory narration, no long spoken sales pitch and no artificial testimonial.': 'DEMO AUDIO: brief optional explanatory voiceover over observable product operation.',
    'MANDATORY AUDIO LANGUAGE: '+SPEECH_LANGUAGES[info.videoLanguage]+'. All dialogue, narration and spoken CTA must be in '+SPEECH_LANGUAGES[info.videoLanguage]+'.',
    'NMF SALES STORY: '+SALES_STRUCTURES[info.style]+' Buyer recognizes friction/desire BEFORE product is offered as solution. Do not start as catalogue or invent efficacy or testimonials.',
    'SECOND-BY-SECOND SELLING PLAN ('+info.duration+'s): '+info.salesBeats.map(b=>b.start+'-'+b.end+'s '+b.name).join(' | ')+'. Every shot serves the product and purchase motive.',
    'PRODUCT: '+info.product+'. Seller description: '+info.sellerDescription+'.',
    !film?'SPOKEN SCRIPT ('+SPEECH_LANGUAGES[info.videoLanguage]+', target market '+info.market+'): "'+info.voice+'". Use naturally; lip-sync only when supported.':'FILM VOICE POLICY: Do not turn the research spoken_script into a presenter monologue. Convey the idea VISUALLY using props, gestures, real product use and elegant motion; optional succinct off-camera voiceover in '+SPEECH_LANGUAGES[info.videoLanguage]+' only when helpful. Final CTA must remain a clear creative action, not hallucinated readable lettering.',
    lockedDirection,
    inputRole,
    productGeometryPrompt(info.productGeometry),
    'HOOK TIMING — HARD EDITORIAL RULE: First 0-'+spokenHookEnd+'s maximum; 3 seconds is the absolute maximum, then advance to buyer problem/desire and product solution. Stop the scroll at frame one; no logo intro or silent establishing shot.',
    formatIdentity,
    'FORMAT CONTRACT '+info.style.toUpperCase()+': '+styleGuide.structure+'. CAMERA: '+styleGuide.camera+'.',
    'STYLE-SPECIFIC POSTPRODUCTION & FINISHING: EDITING: '+styleGuide.editing+'. TRANSITIONS: '+styleGuide.transitions+'. EFFECTS: '+styleGuide.effects+'. SOUND DESIGN: '+styleGuide.sound_design+'. Edits must support story, physical realism and purchase motive; they are generator directions, not separately guaranteed editing.',
    !film?'SPEECH DENSITY: target '+info.voiceBudget.target+' words for '+info.duration+'s; ensure natural timing.':'FILM PACING: concise visual beats, intentional product reveal, professional optical transitions when multi-shot, and sound/music composition. Dialogue is NOT required.',
    'SALES ANGLE: '+info.angle+'. PURCHASING MOTIVE: '+info.buyerMotive+'. RESEARCHED CLAIMS: '+info.researchedClaims.join('; ')+'. Hook: '+(info.hook||'a relatable need')+'.',
    'DIRECTED SHOT TIMING: '+stages,
    'CTA: '+info.cta+'.',
    'SHOT DESIGN: '+info.shots+' coordinated '+(info.shots===1?'continuous take':'shots')+' within '+info.duration+' seconds. '+(productOnly?'Product, physical scale, labels and lighting':'Actor, product, wardrobe and lighting')+' stay consistent; transitions move the commercial story forward.',
    'REALISM: natural skin, face, lips and hand grip, authentic material reflections, camera continuity, accurate bottle geometry and labels. No invented readable lettering, exaggerated effects or CGI floating packaging.',
    'AUDIO & FINISH: authentic foley, professional music mix, coherent color grading and '+(info.shots===1?'continuous optical movement':'motivated cuts')+'. '+(film?'Music and tactile sound may carry the film without speech.':'Sound stays beneath important narration.')+' '+c.videoQualityGuide+'.',
    !info.ugc&&!productOnly&&info.creativeDirection?'APPROVED CREATIVE DIRECTION (only when consistent with cast choice and no UGC): '+info.creativeDirection+'.':'',
    !info.ugc&&!productOnly&&info.aiShots.length?'RESEARCHED SHOT IDEAS (reinterpret as non-UGC film): '+info.aiShots.join(' | ')+'.':'',
  ];
  // Keep the buying argument, researched differences, voice and CTA in the
  // higher-priority half, before any length cap for Muapi prompt fields.
  return instructions.filter(Boolean).join(' ').slice(0,5400);
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,videoLanguage='es',modelId,workflowId=null,duration=8,imageProvided=true,style='auto',shotPreference='auto',castMode='with_people',productGeometry=null,templateId=null,templateActor='hombre',templateSetting='auto',templateChangeRequest=''
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,videoLanguage,modelId,workflowId,duration,imageProvided,style,shotPreference,castMode,productGeometry});
  plan.templateId=getAdTemplate(templateId)?.id||null;
  plan.templateActor=templateActor;
  plan.templateSetting=templateSetting;
  plan.templateChangeRequest=templateChangeRequest;
  const prompt=buildHighConversionVideoPrompt(plan);
  return {
    prompt,spoken_script:plan.voice,hook:plan.hook,cta:plan.cta,
    video_language:plan.videoLanguage,
    template_id:plan.templateId,
    cinematic:plan.cinema,creative_style:plan.style,cast_mode:plan.castMode,shot_count:plan.shots,
    media_role:plan.sourceRole,reference_mode:plan.capabilities.usesReferenceImages?'references':'none',
    model_capabilities:plan.capabilities,product_geometry:plan.productGeometry,
    speech_readiness:plan.voiceReadiness,sales_beats:plan.salesBeats,quality_version:SALES_DIRECTOR_VERSION,
    warning:plan.capabilities.imageRole==='start_frame'
      ?'Este modelo usa la foto como primer fotograma. Para un UGC nuevo, elige Referencias/Omni Reference.'
      :plan.capabilities.imageRole==='none'
        ?'Este modelo no tiene una referencia visual de producto verificada; revisa el envase antes de pagar.'
        :null,
  };
}
