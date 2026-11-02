// Realizo Sales Director V2 — deterministic, zero-extra-LLM-cost quality layer.
// A reference image is not automatically a starting frame. Each model has its
// own actual generation contract. Never substitute one paid model silently.
export const SALES_DIRECTOR_VERSION='sales-v6-hook3-cinematic-finishing-2026-10';
export const SALES_GOAL='conversion';
import {CREATIVE_FORMATS,FORMAT_GUIDES,selectedStyle} from './format-guides.js';
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
  // For a master template, reuse the precise Muapi prompt instead of allowing
  // the general creative director to overwrite the fixed camera/story order.
  if(info.templateId==='ugc-vendedor')return buildLockedUgc30Prompt(info);
  const c=info.capabilities;
  const spokenHookEnd=Math.min(3,info.salesBeats[0].end);
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
    'COMMERCIAL AD, realistic live-action vertical 9:16. Conversion story, NOT silent product animation or slideshow.',
    'TOP-PRIORITY AUDIO DIRECTOR: Begin voice in first 0.3 seconds. Continuous believable speech from problem through product solution, benefit and spoken CTA; no dead air, music-only intro, speech gaps longer than 0.35 seconds or mute cutaways. Do not rush or invent dialogue.',
    'MANDATORY AUDIO LANGUAGE: '+SPEECH_LANGUAGES[info.videoLanguage]+'. All dialogue, narration and spoken CTA must be in '+SPEECH_LANGUAGES[info.videoLanguage]+'.',
    'NMF SALES STORY: '+SALES_STRUCTURES[info.style]+' Buyer recognizes friction/desire BEFORE product is offered as solution. Do not start as catalogue or invent efficacy or testimonials.',
    'SECOND-BY-SECOND SELLING PLAN ('+info.duration+'s): '+info.salesBeats.map(b=>b.start+'-'+b.end+'s '+b.name).join(' | ')+'. All shots serve these beats; continue speech over inserts.',
    'PRODUCT: '+info.product+'. Seller description: '+info.sellerDescription+'.',
    'SPOKEN SCRIPT ('+SPEECH_LANGUAGES[info.videoLanguage]+', target market '+info.market+'): "'+info.voice+'". EXACT sales dialogue, from initial hook to final CTA, not a silent montage. Lip-sync only when model supports native speech.',
    lockedDirection,
    inputRole,
    productGeometryPrompt(info.productGeometry),
    'HOOK TIMING — HARD EDITORIAL RULE: First 0-'+spokenHookEnd+'s maximum; 3 seconds is the absolute maximum, then advance to buyer problem/desire and product solution. Stop the scroll at frame one; no logo intro or silent establishing shot.',
    formatIdentity,
    'FORMAT CONTRACT '+info.style.toUpperCase()+': '+styleGuide.structure+'. CAMERA: '+styleGuide.camera+'.',
    'STYLE-SPECIFIC POSTPRODUCTION & FINISHING: EDITING: '+styleGuide.editing+'. TRANSITIONS: '+styleGuide.transitions+'. EFFECTS: '+styleGuide.effects+'. SOUND DESIGN: '+styleGuide.sound_design+'. Edits must support story, physical realism and purchase motive; they are generator directions, not separately guaranteed editing.',
    'SPEECH DENSITY: target '+info.voiceBudget.target+' words for '+info.duration+'s, natural range '+info.voiceBudget.minimum+'-'+info.voiceBudget.maximum+'. Keep voice present across visuals, no long pauses.',
    'SALES ANGLE: '+info.angle+'. PURCHASING MOTIVE: '+info.buyerMotive+'. RESEARCHED CLAIMS: '+info.researchedClaims.join('; ')+'. Hook: '+(info.hook||'a relatable need')+'.',
    'DIRECTED SHOT TIMING: '+stages,
    'CTA: '+info.cta+'.',
    'SHOT DESIGN: '+info.shots+' coordinated shots within '+info.duration+' seconds. Actor, product and lighting stay consistent; each transition should move the story forward.',
    'REALISM: natural skin, face, lips and hand grip, authentic material reflections, camera continuity, accurate bottle geometry and labels. No invented readable lettering, exaggerated effects or CGI floating packaging.',
    'AUDIO & FINISH: only authentic sound/foley, consistent color grade and motivated cuts. Production sound and music below narration. '+c.videoQualityGuide+'.',
    !info.ugc&&info.creativeDirection?'APPROVED CREATIVE DIRECTION (honor only if compatible with the sales story): '+info.creativeDirection+'.':'',
    !info.ugc&&info.aiShots.length?'RESEARCHED SHOT IDEAS: '+info.aiShots.join(' | ')+'.':'',
  ];
  // Keep the buying argument, researched differences, voice and CTA in the
  // higher-priority half, before any length cap for Muapi prompt fields.
  return instructions.filter(Boolean).join(' ').slice(0,5400);
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,videoLanguage='es',modelId,workflowId=null,duration=8,imageProvided=true,style='auto',shotPreference='auto',productGeometry=null,templateId=null,templateActor='hombre',templateSetting='auto',templateChangeRequest=''
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,videoLanguage,modelId,workflowId,duration,imageProvided,style,shotPreference,productGeometry});
  plan.templateId=getAdTemplate(templateId)?.id||null;
  plan.templateActor=templateActor;
  plan.templateSetting=templateSetting;
  plan.templateChangeRequest=templateChangeRequest;
  const prompt=buildHighConversionVideoPrompt(plan);
  return {
    prompt,spoken_script:plan.voice,hook:plan.hook,cta:plan.cta,
    video_language:plan.videoLanguage,
    template_id:plan.templateId,
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
