// Realizo Sales Director V2 — deterministic, zero-extra-LLM-cost quality layer.
// A reference image is not automatically a starting frame. Each model has its
// own actual generation contract. Never substitute one paid model silently.
export const SALES_DIRECTOR_VERSION='sales-v4-grounded-formats-2026-10';
export const SALES_GOAL='conversion';
import {CREATIVE_FORMATS,FORMAT_GUIDES,selectedStyle} from './format-guides.js';
import {normalizeProductGeometry,productGeometryPrompt} from './product-geometry.js';
import {salesBeatPlan,SALES_STRUCTURES,voiceBudget,scriptReadiness} from './sales-storyboard.js';
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
export function planSalesVideo({concept={},productName='',description='',cta='',market='EC',videoLanguage='es',duration=8,modelId='',workflowId=null,imageProvided=true,style='auto',shotPreference='auto',productGeometry=null}={}){
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
    duration:seconds,style:salesStyle,cinema,shots:preference,
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
export function buildHighConversionVideoPrompt(info){
  const c=info.capabilities;
  const spokenHookEnd=Math.max(1,Math.min(2,Math.round(info.duration*0.13*10)/10));
  const spokenCtaStart=Math.max(spokenHookEnd+0.5,Math.round(info.duration*0.8*10)/10);
  const stages=info.ugc
    ? 'UGC TALKING-HEAD SCHEDULE: 0-'+spokenHookEnd+'s speaker says a compelling hook TO LENS immediately; '+
      spokenHookEnd+'-'+spokenCtaStart+'s same speaker continuously explains the need, product specifics and why to choose it, with at most one very brief supporting insert while the VOICE CONTINUES; '+
      spokenCtaStart+'-'+info.duration+'s speaker returns/keeps eye contact and says the CTA clearly. '+
      'Max '+info.shots+' shots total, no standalone product montage and no silent packaging close-up.'
    : info.duration<=8
    ? info.shots>=3
      ? 'SHOT 1 (0-2s): striking human/problem hook. SHOT 2 (2-5s): meaningful interaction or demonstration. SHOT 3 (last seconds): direct benefit and CTA with product in hand.'
      : 'SHOT 1 (0-2s): immediate spoken hook. SHOT 2 (remainder): naturally handle product, benefit and CTA.'
    : 'Keep the full '+info.duration+'-second structure from the approved concept: opening hook, problem, genuine use, benefit and closing CTA. Allocate all '+info.shots+' shots across the precise duration without an 8-second fallback.';
  const inputRole=info.imageProvided?
    c.usesReferenceImages
      ? 'REFERENCE IMAGE: Use the uploaded product photograph ONLY as an identity/appearance reference. This is NOT the first frame. Build a NEW photorealistic scene with human actor and environment from scratch.'
      : c.imageRole==='start_frame'
        ? 'IMAGE START FRAME LIMITATION: This model uses the uploaded image as its starting frame. It cannot reliably create an independent UGC scene from only this photograph; switch to a reference-capable model for that.'
        : 'PRODUCT LOOK: Recreate only the product described; this selected endpoint has no verified image-reference slot.'
    : 'No product photo available. Do not fabricate readable label text.';
  const instructions=[
    'COMMERCIAL AD, authentic live-action, vertical 9:16, premium production values, photoreal, physically plausible.',
    'PRIMARY OBJECTIVE: measurable purchase intent. NOT a bottle animation, slideshow, rotating product render or silent aesthetic montage.',
    'TOP-PRIORITY AUDIO DIRECTOR: Begin spoken selling within the first 0.3 seconds (no opening silence). The person or narrator speaks naturally and continuously through the problem, product as solution, observable benefit and final purchase CTA. Avoid dead air, speech gaps longer than 0.35 seconds, empty reaction shots, music-only cutaways or silent closing frames. Voice-over must continue beneath supporting visuals, with pacing natural enough to understand every sentence. Preserve normal micro-pauses for meaning but NO protracted gaps. This direction is not a guarantee of native audio capability.',
    'NMF SALES STORY — REQUIRED FOR EVERY STYLE: '+SALES_STRUCTURES[info.style]+' The ad sells by making viewers recognize their situation BEFORE introducing the product as a relevant response. Do NOT start with a product catalog, its bottle dimensions or a bare list of product names. Every visual shot shows the exact problem, real use, meaningful benefit or CTA. Never invent effectiveness or testimonials.',
    'SECOND-BY-SECOND SELLING PLAN ('+info.duration+'s): '+info.salesBeats.map(b=>b.start+'-'+b.end+'s '+b.name).join(' | ')+'. Each segment must advance the SAME credible buyer problem-to-solution story. The narrator/actor continues speaking over cutaways, not just showing handsome images.',
    'SPEECH DENSITY: target roughly '+info.voiceBudget.target+' spoken words for '+info.duration+'s in '+info.style+'; comfortable range '+info.voiceBudget.minimum+'-'+info.voiceBudget.maximum+'. Voice should fill most of the clip without rushing. If this approved script is too short, compress pauses and let use/benefit narration continue, but do not make up words or repeat unverified claims.',

    info.ugc?
      'UGC SALES REVIEW: This is a real direct-to-camera review-style sales presentation with a relatable problem, not a product catalogue. VOICE-FIRST EDITING: voice NEVER stops for supporting inserts; no standalone product montage, no mute product shots. Keep the creator speaking to the lens, with one quick product demonstration and a spoken CTA. Natural UGC, not cinematic beauty footage.'
      :'NON-UGC VOICE STORY: Use narration or dialogue to express the human problem, make the product a credible solution, and carry the benefit into the CTA. Do not use silent cutaways or beauty-only montage.',
    'SHOT DESIGN: '+info.shots+' coordinated shots within '+info.duration+' seconds; every shot supports a sales beat. Do not prolong quiet intros.',
    inputRole,
    // Geometry must survive the final 5,400-character engine prompt cutoff.
    productGeometryPrompt(info.productGeometry),
    'PRODUCT: '+info.product+'. Seller description: '+info.sellerDescription+'.',
    'SPOKEN SCRIPT ('+SPEECH_LANGUAGES[info.videoLanguage]+', target market '+info.market+'): "'+info.voice+'". Lip-synchronized natural delivery IF the selected model supports speech. If not, reserve clean audio space for a separately recorded voice track; do not pretend speech exists.',
    'SALES ANGLE: '+info.angle+'. PURCHASING MOTIVE: '+info.buyerMotive+'. BUYER RELEVANT CLAIMS FROM RESEARCH: '+info.researchedClaims.join('; ')+'. Open with this hook: '+(info.hook||'a relatable need')+'.',
    'FORMAT CONTRACT '+info.style.toUpperCase()+': '+FORMAT_GUIDES[info.style].structure+'. '+FORMAT_GUIDES[info.style].camera+'. '+FORMAT_GUIDES[info.style].audio+'. DO NOT: '+FORMAT_GUIDES[info.style].forbidden+'.',
    // A legacy researched montage can explicitly demand 4-5 silent cuts.
    // Never inject those conflicting instructions into a talking-head UGC prompt.
    !info.ugc&&info.creativeDirection?'APPROVED CREATIVE DIRECTION: '+info.creativeDirection+'.':'',
    !info.ugc&&info.aiShots.length?'RESEARCHED SHOT IDEAS (adapt to timing): '+info.aiShots.join(' | ')+'.':'',
    info.ugc?'UGC SALES REVIEW — MOST IMPORTANT: this is a spoken social-commerce presentation, NOT product beauty footage. Show one relatable adult creator looking straight into a phone camera and TALKING through virtually the whole clip. Their face and speaking performance must be dominant (at least 70-85% of running time), starting at frame one with a genuine, attention-grabbing question or problem. First-person conversational explanation of what is being sold, the concrete benefit(s) supported by seller details, why this product or combo makes sense and how a viewer can order. Speak with believable Ecuadorian-market Spanish cadence where selected; natural, confident, persuasive, no artificial acting or generic greetings. Cutaways only support spoken claims; voice NEVER stops for product close-ups. Do not invent personal usage results, endorsements or real-buyer testimonials.'
      :'Show real interaction with the product and a clear reason to purchase; meaningful action, not beauty shots alone.',
    'DIRECTED SHOT TIMING: '+stages,
    'MANDATORY AUDIO LANGUAGE: '+SPEECH_LANGUAGES[info.videoLanguage]+'. All dialogue, speech, vocal CTA and acting mouth movements must be in '+SPEECH_LANGUAGES[info.videoLanguage]+'. Do not speak English unless English is explicitly selected.',

    'CTA: '+info.cta+'.',
    'SHOT DESIGN: '+info.shots+' coordinated shots within '+info.duration+' seconds. Match each shot to its assigned sales beat. Maintain one continuous recognizable actor, the original product(s) identity, consistent set and wardrobe across cuts.',
    info.ugc?'VOICE-FIRST EDITING: Use an uninterrupted conversational audio track from the opening hook through the final spoken purchase CTA; no music-only intro, no unvoiced demonstrations, no lingering silent frames, and no empty filler. Short inserts of product are overlays over the SAME SPEAKING voice; never replace the creator with a long silent bathroom routine.':'',
    info.style==='cinematic'?'CINEMATOGRAPHIC: believable visual micro-story, clear context and change, motivated framing and cuts, actors living a realistic situation, video conveys purchase motivation, narrative VO only as needed. NOT selfie review.':
     info.style==='premium'?'PREMIUM COMMERCIAL: tactile pack details, understated visual storytelling, controlled physically plausible light, authentic material and careful premium positioning WITHOUT invented luxury claims or synthetic-looking actor. NOT selfie review.':
     info.style==='demo'?'PRODUCT DEMONSTRATION: real hands and real operation step by step, clear action-result continuity, truthful scale and use, short explanatory voiceover if needed. NOT a monologue or glossy montage.':
     'SOCIAL UGC: direct-to-camera review framing in a believable home setting, phone-camera imperfection, clear mouth visibility for speech and eye contact. Allow one short hand-held close-up of the original product while the creator keeps talking, then return to their face for the spoken CTA.',
    'HYPERREAL HUMAN VIDEO: believable asymmetry, natural skin pores and small imperfections, coherent facial muscles and lip movements, normal blinks, plausible hand grips and finger count, tiny wardrobe wrinkles, grounded body mass, natural gait and stable shadows. CAMERA: coherent optics, modest autofocus and exposure breathing when phone filmed, no floating cinematic movements for UGC. LIGHT: practical coherent light and believable reflections, never polished plastic CGI.',
    'PRODUCT CONTINUITY: preserve bottle geometry, closure, colors, branding and visible design. Never morph packaging or hallucinate readable label copy.',
    info.ugc?'AUDIO REQUIREMENT: this creative NEEDS spoken audio throughout for a complete UGC ad. Request lip-synced speech ONLY if the selected endpoint truly supports it. If voice generation is unavailable, treat the output as a visual draft requiring a separate synchronized voiceover, NOT a finished silent UGC testimonial. Never impersonate a genuine satisfied customer.':
      'AUDIO: natural voice when genuinely supported; otherwise use voiceover plan. No fake testimonial of a real customer.',
    'Avoid excessive transitions, fake overlays, hallucinated letters and awkward product motion. '+c.videoQualityGuide+'.',
  ];
  // Keep the buying argument, researched differences, voice and CTA in the
  // higher-priority half, before any length cap for Muapi prompt fields.
  return instructions.filter(Boolean).join(' ').slice(0,5400);
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,videoLanguage='es',modelId,workflowId=null,duration=8,imageProvided=true,style='auto',shotPreference='auto',productGeometry=null
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,videoLanguage,modelId,workflowId,duration,imageProvided,style,shotPreference,productGeometry});
  const prompt=buildHighConversionVideoPrompt(plan);
  return {
    prompt,spoken_script:plan.voice,hook:plan.hook,cta:plan.cta,
    video_language:plan.videoLanguage,
    cinematic:plan.cinema,creative_style:plan.style,shot_count:plan.shots,
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
