// Realizo Sales Director V2 — deterministic, zero-extra-LLM-cost quality layer.
// A reference image is not automatically a starting frame. Each model has its
// own actual generation contract. Never substitute one paid model silently.
export const SALES_DIRECTOR_VERSION='sales-v2-2026-10';
export const SALES_GOAL='conversion';
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
export function planSalesVideo({concept={},productName='',description='',cta='',market='EC',videoLanguage='es',duration=8,modelId='',workflowId=null,imageProvided=true,style='auto',shotPreference='auto'}={}){
  const angle=sentence(concept.angle||'benefits',40).toLowerCase();
  const salesStyle=['auto','ugc','cinematic','premium','demo'].includes(style)?style:'auto';
  const ugc=salesStyle==='ugc' || (salesStyle==='auto' && /(ugc|problem|testimonial|benefit|direct|demo)/i.test(angle+' '+concept.name));
  const cinema=salesStyle==='cinematic'||salesStyle==='premium';
  const seconds=Math.max(1,Math.min(120,Number(duration)||8));
  const maxShots=seconds<=6?2:seconds<=9?3:seconds<=15?5:seconds<=30?7:Math.min(12,Math.ceil(seconds/4));
  const preference=shotPreference==='single'?1:shotPreference==='multi'?maxShots:
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
  const voice=wordList.length>maxWords?wordList.slice(0,maxWords).join(' '):providedSpeech;
  const caps=videoEngineCapabilities(modelId,workflowId);
  return {
    angle,ugc,market,videoLanguage:SPEECH_LANGUAGES[videoLanguage]?videoLanguage:'es',product,sellerDescription,hook,voice,cta:finalCta,
    duration:seconds,style:salesStyle,cinema,shots:preference,
    creativeDirection,aiShots,capabilities:caps,imageProvided,
    hasVoiceover:voice.length>0,
    sourceRole:'reference_only',
  };
}
export function buildHighConversionVideoPrompt(info){
  const c=info.capabilities;
  const stages=info.duration<=8
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
    inputRole,
    'PRODUCT: '+info.product+'. Seller description: '+info.sellerDescription+'.',
    'SALES ANGLE: '+info.angle+'. Open with this short hook: '+(info.hook||'a relatable need')+'.',
    info.creativeDirection?'APPROVED CREATIVE DIRECTION: '+info.creativeDirection+'.':'',
    info.aiShots.length?'RESEARCHED SHOT IDEAS (adapt to timing): '+info.aiShots.join(' | ')+'.':'',
    info.ugc?'UGC: Real adult human speaking to camera in a credible everyday setting, hand physically holding and using the product, convincing natural micro-expressions, subtle phone-camera movement, accurate gaze and timing.'
      :'Show real interaction with the product and a clear reason to purchase; meaningful action, not beauty shots alone.',
    'DIRECTED SHOT TIMING: '+stages,
    'MANDATORY AUDIO LANGUAGE: '+SPEECH_LANGUAGES[info.videoLanguage]+'. All dialogue, speech, vocal CTA and acting mouth movements must be in '+SPEECH_LANGUAGES[info.videoLanguage]+'. Do not speak English unless English is explicitly selected.',
    'SPOKEN SCRIPT ('+SPEECH_LANGUAGES[info.videoLanguage]+', target market '+info.market+'): "'+info.voice+'". Lip-synchronized natural delivery IF the selected model supports speech. If not, reserve clean audio space for a separately recorded voice track; do not pretend speech exists.',
    'CTA: '+info.cta+'.',
    'SHOT DESIGN: '+info.shots+' coordinated shots within '+info.duration+' seconds. Maintain one continuous recognizable actor, one exact product identity, consistent set and wardrobe across cuts.',
    info.cinema?'CINEMATOGRAPHIC: premium commercial-grade blocking, deliberate shot-reverse-shot when appropriate, handheld-to-slider transitions, motivated close-ups, elegant contrast and precise sound design. Natural acting; not artificial slow-motion.':
     'SOCIAL UGC: polished but believable phone-camera coverage; alternate a tight selfie shot, over-the-shoulder demonstration and compelling product close-up, all with realistic cuts and human reactions.',
    'CAMERA: motivated movement, realistic autofocus, coherent perspective, natural skin texture, consistent hands and product geometry. LIGHT: directional practical light, plausible reflections, no plastic CGI gloss.',
    'PRODUCT CONTINUITY: preserve bottle geometry, closure, colors, branding and visible design. Never morph packaging or hallucinate readable label copy.',
    'AUDIO: natural voice when genuinely supported; otherwise use voiceover plan. No fake testimonial of a real customer.',
    'Avoid excessive transitions, fake overlays, hallucinated letters and awkward product motion. '+c.videoQualityGuide+'.',
  ];
  return instructions.join(' ').slice(0,5400);
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,videoLanguage='es',modelId,workflowId=null,duration=8,imageProvided=true,style='auto',shotPreference='auto'
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,videoLanguage,modelId,workflowId,duration,imageProvided,style,shotPreference});
  const prompt=buildHighConversionVideoPrompt(plan);
  return {
    prompt,spoken_script:plan.voice,hook:plan.hook,cta:plan.cta,
    video_language:plan.videoLanguage,
    cinematic:plan.cinema,creative_style:plan.style,shot_count:plan.shots,
    media_role:plan.sourceRole,reference_mode:plan.capabilities.usesReferenceImages?'references':'none',
    model_capabilities:plan.capabilities,quality_version:SALES_DIRECTOR_VERSION,
    warning:plan.capabilities.imageRole==='start_frame'
      ?'Este modelo usa la foto como primer fotograma. Para un UGC nuevo, elige Referencias/Omni Reference.'
      :plan.capabilities.imageRole==='none'
        ?'Este modelo no tiene una referencia visual de producto verificada; revisa el envase antes de pagar.'
        :null,
  };
}
