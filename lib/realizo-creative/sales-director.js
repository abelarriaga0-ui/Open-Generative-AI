// Realizo Sales Director V2 — deterministic, zero-extra-LLM-cost quality layer.
// A reference image is not automatically a starting frame. Each model has its
// own actual generation contract. Never substitute one paid model silently.
export const SALES_DIRECTOR_VERSION='sales-v2-2026-10';
export const SALES_GOAL='conversion';

const normalize=(x='')=>String(x).replace(/\s+/g,' ').trim();
export function normalizeProductCopy(value=''){
  // Correct ordinary seller typos transparently, without changing claims.
  return normalize(value)
    .replace(/\bshamppo\b/gi,'shampoo')
    .replace(/\bceboreica\b/gi,'seborreica')
    .replace(/\bdermatitis seborreica\b/gi,'dermatitis seborreica')
    .replace(/\bpor hasat\b/gi,'por hasta');
}
export function videoEngineCapabilities(modelId=''){
  const id=String(modelId).toLowerCase();
  // Only claim a documented reference contract when its endpoint supports it.
  const hasReferences=/(?:omni-reference|reference-to-video|omni-image-to-video|reference-video)/.test(id);
  const startFrame=/(?:image-to-video|(?:^|-)i2v|first-last-frame)/.test(id)&&!hasReferences;
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
export function planSalesVideo({concept={},productName='',description='',cta='',market='EC',duration=8,modelId='',imageProvided=true}={}){
  const angle=sentence(concept.angle||'benefits',40).toLowerCase();
  const ugc=/(ugc|problem|testimonial|benefit|direct|demo)/i.test(angle+' '+concept.name);
  const finalCta=sentence(cta||concept.cta||'Conoce el producto',90);
  const product=sentence(normalizeProductCopy(productName),100);
  const sellerDescription=sentence(normalizeProductCopy(description),500);
  const hook=sentence(normalizeProductCopy(concept.hook||''),115);
  const providedSpeech=sentence(normalizeProductCopy(concept.spoken_script||concept.script||''),340);
  // 2.4 words/sec is a natural upper bound for short Spanish UGC.
  // Avoid attempting 40 spoken words in 7 seconds; one thought must land.
  const maxWords=Math.max(7,Math.floor(Number(duration||8)*2.4));
  const wordList=providedSpeech.split(/\s+/).filter(Boolean);
  const voice=wordList.length>maxWords?wordList.slice(0,maxWords).join(' '):providedSpeech;
  const caps=videoEngineCapabilities(modelId);
  return {
    angle,ugc,market,product,sellerDescription,hook,voice,cta:finalCta,
    duration:Number(duration)||8,capabilities:caps,imageProvided,
    hasVoiceover:voice.length>0,
    sourceRole:'reference_only',
  };
}
export function buildHighConversionVideoPrompt(info){
  const c=info.capabilities;
  const stages=info.duration<=8
    ? '0-2s: visually disruptive human/problem hook. 2-5s: product interaction and clear benefit. Final seconds: memorable CTA and product close-up.'
    : 'First 2s: hook. Next third: relatable need. Middle: natural demonstration. Final third: benefit, product and CTA.';
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
    info.ugc?'UGC: Real adult human speaking to camera in a credible everyday setting, hand physically holding and using the product, convincing natural micro-expressions, subtle phone-camera movement, accurate gaze and timing.'
      :'Show real interaction with the product and a clear reason to purchase; meaningful action, not beauty shots alone.',
    'DIRECTED SHOT TIMING: '+stages,
    'SPOKEN SCRIPT (Spanish, '+info.market+'): "'+info.voice+'". Lip-synchronized natural delivery IF the selected model supports speech. If not, reserve clean audio space for a separately recorded voice track; do not pretend speech exists.',
    'CTA: '+info.cta+'.',
    'CAMERA: motivated movement, realistic autofocus, coherent perspective, natural skin texture, consistent hands and product geometry. LIGHT: directional practical light, plausible reflections, no plastic CGI gloss.',
    'PRODUCT CONTINUITY: preserve bottle geometry, closure, colors, branding and visible design. Never morph packaging or hallucinate readable label copy.',
    'AUDIO: natural voice when genuinely supported; otherwise use voiceover plan. No fake testimonial of a real customer.',
    'Avoid excessive transitions, fake overlays, hallucinated letters and awkward product motion. '+c.videoQualityGuide+'.',
  ];
  return instructions.join(' ').slice(0,5400);
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,modelId,duration=8,imageProvided=true
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,modelId,duration,imageProvided});
  const prompt=buildHighConversionVideoPrompt(plan);
  return {
    prompt,spoken_script:plan.voice,hook:plan.hook,cta:plan.cta,
    media_role:plan.sourceRole,reference_mode:plan.capabilities.usesReferenceImages?'references':'none',
    model_capabilities:plan.capabilities,quality_version:SALES_DIRECTOR_VERSION,
    warning:plan.capabilities.imageRole==='start_frame'
      ?'Este modelo usa la foto como primer fotograma. Para un UGC nuevo, elige Referencias/Omni Reference.'
      :plan.capabilities.imageRole==='none'
        ?'Este modelo no tiene una referencia visual de producto verificada; revisa el envase antes de pagar.'
        :null,
  };
}
