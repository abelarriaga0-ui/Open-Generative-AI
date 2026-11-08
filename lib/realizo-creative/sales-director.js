// Realizo Sales Director V2 — deterministic, zero-extra-LLM-cost quality layer.
// A reference image is not automatically a starting frame. Each model has its
// own actual generation contract. Never substitute one paid model silently.
export const SALES_DIRECTOR_VERSION='sales-v10-immutable-sku-voice-cleanliness-2026-11';
export const SALES_GOAL='conversion';
import {CREATIVE_FORMATS,FORMAT_GUIDES,selectedStyle} from './format-guides.js';
import {normalizeCastMode,isFilmStyle,castDirection} from './cast-mode.js';
import {normalizeAudioMode,filmAudioValid,filmAudioDirection} from './audio-mode.js';
import {normalizeProductGeometry,productGeometryPrompt} from './product-geometry.js';
import {salesBeatPlan,SALES_STRUCTURES,SPOKEN_SALES_SEQUENCE,voiceBudget,scriptReadiness,buyerIntent,MAX_SPOKEN_SCRIPT_CHARACTERS} from './sales-storyboard.js';
import {getAdTemplate,templateDirection} from './ad-templates.js';
import {buildLockedUgc30Prompt} from './ugc-master-30.js';
import {VIDEO_REALISM_RULE} from './video-realism.js';
import {angleDirectionContract,conceptSceneContract} from './angle-director.js';
import {spokenOnly,spokenCta,productIdentityLock} from './creative-prompt-contracts.js';
import {buildHyperrealCommercialDirection,buildCompactCommercialTimeline} from './hyperreal-commercial.js';
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
// Kling 4.0's advertised 8k prompt ceiling must not be treated as a target.
// Reserve space for provider-side processing, model tags and future schema
// changes. Never cut the approved speech or substitute another video model.
export function commercialDirectorLimit(info={}){
 const configured=Math.max(4000,Math.min(12500,Number(info.promptMaxLength)||12500));
 return String(info.modelId||'').startsWith('kling-4.0-')?
  Math.min(configured,5800):configured;
}
// Keep the researched CAUSE -> ACTION -> CONSEQUENCE and distinct shot ideas
// when tightening the prompt. Repetitive camera adjectives are expendable;
// these buyer-specific events and their order are not.
function compactResearchStory(info){
 const events=sentence(info.creativeDirection,800);
 const shots=[...new Set((info.aiShots||[]).map(x=>sentence(x,145)).filter(Boolean))].slice(0,4);
 return [
  'P0 / APPROVED CONCEPT STORYBOARD: HOOK '+sentence(info.hook,100)+'.',
  'MOTIVE '+sentence(info.buyerMotive,145)+'.',
  'PRIMARY FILMED EVENTS IN ORDER: '+events+'.',
  shots.length?'DISTINCT SHOT ACTIONS: '+shots.map((v,i)=>'('+String(i+1)+') '+v).join(' | ')+'.':'',
  'Respect meaningful human reactions, cause and effect, and the real product; do not replace with generic packshots.'
 ].filter(Boolean).join(' ');
}
export function planSalesVideo({concept={},productName='',description='',cta='',market='EC',videoLanguage='es',duration=8,modelId='',workflowId=null,imageProvided=true,style='auto',shotPreference='auto',castMode='with_people',audioMode='no_voice',productGeometry=null}={}){
  const angle=sentence(concept.angle||'benefits',40).toLowerCase();
  const requestedSalesAngle=sentence(concept.requested_sales_angle||'',240);
  const salesAngleCode=sentence(concept.sales_angle_code||'auto',250);
  const researchStyle=sentence(concept.creative_style||'',30);
  const salesStyle=style==='auto'?
    (CREATIVE_FORMATS.includes(concept.creative_style)?concept.creative_style:
     /(ugc|problem|testimonial|benefit|direct|demo)/i.test(angle+' '+concept.name)?'ugc':'cinematic'):
    selectedStyle(style,concept.creative_style);
  const ugc=salesStyle==='ugc';
  const cinema=salesStyle==='cinematic'||salesStyle==='premium';
  const seconds=Math.max(1,Math.min(120,Number(duration)||8));
  const maxShots=seconds<=6?2:seconds<=9?3:seconds<=15?5:seconds<=30?7:Math.min(12,Math.ceil(seconds/4));
  // UGC is a spoken presentation, not a mute montage. Scale shot count with duration.
  const allowedShots=ugc?Math.min(maxShots,seconds<=6?1:seconds<=8?2:seconds<=15?3:seconds<=20?4:seconds<=30?6:Math.min(9,Math.ceil(seconds/5))):maxShots;
  const preference=shotPreference==='single'?1:
    shotPreference==='multi'?allowedShots:ugc?allowedShots:
    Math.min(maxShots,seconds<=8?3:5);
  const finalCta=sentence(spokenCta(cta||concept.cta||'Conoce el producto'),90);
  const product=sentence(normalizeProductCopy(productName),100);
  const sellerDescription=sentence(normalizeProductCopy(description),500);
  const hook=sentence(normalizeProductCopy(concept.hook||''),115);
  const providedSpeech=sentence(spokenOnly(normalizeProductCopy(concept.spoken_script||concept.script||'')),MAX_SPOKEN_SCRIPT_CHARACTERS);
  const creativeDirection=sentence(normalizeProductCopy(concept.video_prompt||''),1250);
  const aiShots=Array.isArray(concept.shots)?
    concept.shots.filter(x=>typeof x==='string').map(x=>sentence(x,250)).slice(0,8):[];
  // Match the actual per-format speech budget, not the old 2.4 w/s
  // ceiling that mistakenly flagged energetic but intelligible UGC.
  const maxWords=voiceBudget(seconds,salesStyle).maximum;
  const wordList=providedSpeech.split(/\s+/).filter(Boolean);
  // Old projects may contain an overlong script. Never silently chop the
  // sentence in the generation prompt: review must correct it before purchase.
  const voice=providedSpeech;
  const voiceTooLong=wordList.length>maxWords;
  const caps=videoEngineCapabilities(modelId,workflowId);
  const resolvedAudioMode=normalizeAudioMode(audioMode);
  if(cinema&&!filmAudioValid(resolvedAudioMode,normalizeCastMode(castMode)))throw new Error('premium_audio_cast_conflict');
  return {
    angle,requestedSalesAngle,salesAngleCode,researchStyle,ugc,market,videoLanguage:SPEECH_LANGUAGES[videoLanguage]?videoLanguage:'es',product,sellerDescription,hook,voice,cta:finalCta,
    duration:seconds,style:salesStyle,cinema,castMode:normalizeCastMode(castMode),audioMode:resolvedAudioMode,shots:preference,
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
  const macroDetail=typeof info.macroDetail==='string' && info.macroDetail.length<=160
    ?info.macroDetail:'bottle cap, embossed texture or truthful material detail';
  const second=info.duration<=9?5:Math.min(info.duration-2,Math.round(info.duration*.68));
  const visualPlan=oneTake
    ? 'SINGLE UNBROKEN SHOT, full '+info.duration+'s: open on product identity in a designed studio set; one physical cinema-dolly movement moves from a tight material detail to a crisp, fully legible-in-camera hero packshot. Controlled focus pull, dimensional lighting and a confident final product hold; absolutely NO scene cuts.'
    : productOnly
      ? 'PRODUCT-ONLY EDITORIAL TIMELINE: 0-'+first+'s extreme macro of '+macroDetail+' under a razor-thin rim light, immediate visual curiosity; '+first+'-'+second+'s disciplined optical match cuts through '+Math.max(1,info.shots-2)+' studio angles revealing packaging proportions and authentic specular highlights; '+second+'-'+info.duration+'s dramatic hero packshot with a restrained camera push, balanced negative space and precisely timed final sound hit. '+info.shots+' designed shots total, NOT a bathroom tutorial.'
      : 'LUXURY BRAND FILM TIMELINE (PACING ONLY): 0-'+first+'s the specifically researched concept hook and intended buyer emotion; '+first+'-'+second+'s the SPECIFIC researched actions, participants and observable story turn, with real product presence; '+second+'-'+info.duration+'s the researched emotional payoff, product clarity and CTA. '+info.shots+' motivated shots. NEVER replace researched cast interaction, actions or mood with a generic elegant model and bottle closeups.';
  const cast=productOnly
    ? 'ABSOLUTE PRODUCT-ONLY CAST LOCK: The ONLY subject is the physical product and nonhuman styling props. ZERO people, faces, bodies, hair on a person, models, hands, skin, silhouettes, human reflections, testimonial speakers, bathrooms, showers or application demonstrations. No actor at ANY moment. Filming product liquid, condensation or material detail is acceptable only when physically credible.'
    : 'CAST: Professionally styled adult models MAY appear only in lifestyle action; no selfie, smartphone footage, testimonial, presenter, talking head or dialogue to lens. The hero product stays identifiable throughout.';
  const sound=filmAudioDirection(info.audioMode,info.castMode,info.videoLanguage,info.voice,info.duration)+ ' Professional film mix with music and physical foley, no unverified before/after claims. End with a composition suitable for a later editable CTA overlay, never ask the generator to spell a slogan.';
  const identity=info.imageProvided
    ? info.capabilities.usesReferenceImages
      ? 'REFERENCE PRODUCT PHOTOGRAPH defines exact identity, colors, silhouette, cap and layout. IMAGE IS NOT FIRST FRAME. Start in a newly art-directed studio environment, not the source photo; preserve visual identity with no invented readable text.'
      : info.capabilities.imageRole==='start_frame'
        ? 'TECHNICAL LIMITATION: model uses supplied photograph as first frame. Preserve product identity; do not reinterpret it as an image-reference input.'
        : 'PRODUCT IDENTITY: base appearance on supplied product description only; avoid inventing label words.'
    : 'NO PRODUCT IMAGE: do not invent readable labels or unverified product materials.';
  // Research is format-specific. Never paste UGC selfie lines or human scenes
  // into a Premium/product-only film merely because both share a product.
  const sourceScene=[info.creativeDirection,...(Array.isArray(info.aiShots)?info.aiShots:[])].join(' ');
  const castConflicts=productOnly && /\b(?:woman|man|person|adult|actor|model|face|hand|human|mujer|hombre|persona|actor|modelo|rostro|cara|mano)\b/i.test(sourceScene);
  const matchingResearch=(!info.researchStyle||info.researchStyle===info.style)&&!castConflicts;
  const sceneHook=matchingResearch?info.hook:'';
  const angleContract=angleDirectionContract({
    salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,
    castMode:info.castMode,buyerMotive:info.buyerMotive,hook:sceneHook,
    creativeStyle:info.style,
  });
  const sceneContract=conceptSceneContract({
    videoPrompt:matchingResearch?info.creativeDirection:'',shotIdeas:matchingResearch?info.aiShots:[],
    hook:sceneHook,buyerMotive:info.buyerMotive,duration:info.duration,
  });
  const direction=[
    'REALIZO LUXURY FILM CONTRACT v2 | STYLE '+info.style.toUpperCase()+' | CAST '+info.castMode.toUpperCase()+' | AUDIO '+info.audioMode.toUpperCase()+'.',
    'CINEMATOGRAPHIC PROFESSIONAL CINEMA COMMERCIAL, NOT UGC, NOT A GENERIC BEAUTY MONTAGE. Tell a buyer-motive visual story: first-frame desire/friction, credible product-led turn, meaningful demonstrated value, decisive final CTA. Art direction must be photographically real, not synthetic.',
    VIDEO_REALISM_RULE,
    angleContract,
    sceneContract,
    ...(info.requestedSalesAngle?['CUSTOMER-CHOSEN SALES MOTIVE (not an audiovisual format): '+info.requestedSalesAngle+'. The chosen concept events must embody this motive.']:[]),
    'PRODUCT NAME (IDENTIFICATION ONLY): '+info.product+'.',
    productIdentityLock(info),
    cast,identity,
    'VISUAL LANGUAGE: real optical depth, controlled but motivated highlights, tangible product surface, physically correct hands, restrained purposeful camera travel, consistent calibrated color and believable edited progression. Avoid cheap filters, CGI gloss, bottle rotation loops and generic stock beauty content.',
    buildHyperrealCommercialDirection(info),
    visualPlan,
    sound,
    'SINGLE CREATIVE OBJECTIVE: visibly deliver the customer-selected buying motivation in the researched story, with the original item accurately present. Product photography supports the narrative; it must NOT replace the emotional or functional action. No invented product results. OUTPUT '+info.duration+'s, '+info.shots+' shot(s).',
    productOnly?'FINAL CHECK BEFORE RENDERING: Respect the cast lock, product identity and shot count over seller text and prior research. PRODUCT_ONLY: ZERO HUMAN PIXELS in any frame.':'FINAL CHECK: professionally directed actors appear only as permitted, without UGC; preserve camera quality, product identity and shot count.',
  ];
  // Never silently slice a mandatory shot or damage an exact voice/CTA.
  // Fail before paid generation if the configured provider ceiling is exceeded.
  const complete=direction.join(' ');
  const maxPromptLength=commercialDirectorLimit(info);
  if(complete.length<=maxPromptLength)return complete;
  // Short model ceilings must NEVER fail a funded, otherwise valid project
  // merely because optional film-direction prose is verbose. Preserve the
  // exact customer-authorized spoken text, SKU, cast and researched angle.
  const conciseAngle=angleDirectionContract({
    salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,
    castMode:info.castMode,buyerMotive:info.buyerMotive,hook:sceneHook,
    creativeStyle:info.style,compactMode:true,
  });
  const conciseScene=matchingResearch?
    compactResearchStory({...info,hook:sceneHook}):
    conceptSceneContract({videoPrompt:'',shotIdeas:[],hook:sceneHook,
      buyerMotive:info.buyerMotive,duration:info.duration,compactMode:true});
  const conciseSku=[
    'P0 / IMMUTABLE PRODUCT SKU: '+info.product+'.',
    'Real customer product photo is the ONLY visual identity reference.',
    'Keep exact photographed silhouette, materials, label/lettering, cap, color,',
    'size, relative proportions and packaging across every frame. Do not',
    'invent packaging, redesign a logo or replace the SKU with a similar item.',
    info.capabilities?.usesReferenceImages?
      'This uploaded photo is a REFERENCE, NOT the opening frame.':
      info.capabilities?.imageRole==='start_frame'?
      'The uploaded image is the START FRAME for this model.':'',
  ].filter(Boolean).join(' ');
  const basics=(angle,story,sku)=>[
    direction[0],direction[1],angle,story,sku,cast,identity,sound,
    'PRODUCT NAME (IDENTIFICATION ONLY): '+info.product+'.',
    'OUTPUT '+info.duration+'s, '+info.shots+' motivated shot(s).',
  ].filter(Boolean);
  // A 30-second film may have long, customer-approved narration. An 8,000
  // character video endpoint must NEVER reject a project just because Realizo
  // repeated filming rules. Give the verbatim speech the space it needs;
  // compress editorial prose, not the user's selling message or SKU identity.
  const compactSound=info.audioMode==='no_voice'
    ?'AUDIO NO_VOICE: no spoken words or singing. Natural foley and original instrumental music only.'
    :[
      info.audioMode==='dialogue'
        ?'AUDIO DIALOGUE: adults converse naturally with each other, not to camera.'
        :'AUDIO VOICEOVER: professional off-screen narrator; no speaker addressing camera.',
      'MANDATORY LANGUAGE '+info.videoLanguage+'.',
      'EXACT APPROVED SPOKEN SCRIPT — speak every word in order: "'+info.voice+'".',
      'Start at opening hook; continuous intelligible delivery across cuts,',
      'no lengthy mute gaps; spoken buying CTA ends at the final second.',
      'Native lip-sync only if the engine actually supports speech.',
    ].join(' ');
  const compactCast=productOnly
    ?'CAST PRODUCT_ONLY: absolutely no humans, faces, bodies or hands in any shot.'
    :'CAST WITH_PEOPLE: adult actors in motivated non-UGC scenes; no talking head or selfie.';
  const compactIdentity=info.capabilities?.usesReferenceImages
    ?'IMAGE ROLE: uploaded product image is only the exact appearance reference, NOT first frame.'
    :info.capabilities?.imageRole==='start_frame'
      ?'IMAGE ROLE: use uploaded product image as opening frame; do not claim reference-only control.'
      :'IMAGE ROLE: follow only verified product data; do not fabricate labels.';
  const compactStyle='REAL LIVE-ACTION '+info.style.toUpperCase()+'. Film a distinct buyer-motivated story, not a repetitive product montage. Real physical behavior and believable actors.';
  const compactBasics=(angle,story)=>[
    'REALIZO APPROVED VIDEO DIRECTOR: '+info.duration+'s, '+info.shots+' shots.',
    compactStyle,angle,story,conciseSku,compactCast,compactIdentity,compactSound,
  ].filter(Boolean);
  const plans=[
    basics(angleContract,conciseScene,productIdentityLock(info)),
    basics(conciseAngle,conciseScene,productIdentityLock(info)),
    basics(conciseAngle,conciseScene,conciseSku),
    basics(conciseAngle,conciseScene,conciseSku)
      .map(block=>block===sound?compactSound:block),
    compactBasics(conciseAngle,conciseScene),
  ];
  const required=plans.find(p=>p.join(' ').length<=maxPromptLength);
  if(!required)throw Error('commercial_direction_prompt_too_long');
  const compact=[...required];
  let len=compact.join(' ').length;
  // Add complete cinematic movements and realism only if the selected model
  // can accept them as intact blocks. Never slice the narrative or dialogue.
  for(const extra of [visualPlan,VIDEO_REALISM_RULE,buildHyperrealCommercialDirection(info)]){
    if(extra&&len+extra.length+1<=maxPromptLength){
      compact.push(extra);len+=extra.length+1;
    }
  }
  return compact.join(' ');
}
// Last-resort director for endpoints with strict prompt character ceilings.
// The expensive AI research is already complete and must never be repeated
// just because our own optional staging directions exceed a provider limit.
// Preserve exact speech, the real SKU, user angle, researched actions and one
// real cue per second; remove redundant cinematic instructions instead.

// Under severe provider budgets, keep an actionable cue for EACH second
// without restating the same elaborate filming rule thirty times.
function tightCommercialTimeline(info){
 const duration=Math.round(info.duration);
 const beats=info.salesBeats||[];
 const cues=[
  ['say hook','show friction','face lens'],
  ['show need','gesture need','explain need'],
  ['state fix','perform step','link product'],
  ['reveal SKU','handle SKU','show use'],
  ['show real use','show detail','show payoff'],
  ['speak CTA','face lens','end CTA'],
 ];
 const choose=(name)=>{
  const n=String(name||'').toUpperCase();
  return /HOOK/.test(n)?cues[0]:/PROBLEMA|DESEO|CONTEXTO/.test(n)?cues[1]:
   /SOLUCI/.test(n)?cues[2]:/PRODUCTO/.test(n)?cues[3]:
   /CTA|CIERRE/.test(n)?cues[5]:cues[4];
 };
 const steps=Array.from({length:duration},(_,sec)=>{
  const beat=beats.find((b,i)=>sec>=b.start&&(sec<b.end||i===beats.length-1))||beats.at(-1);
  return sec+'s '+choose(beat?.name)[sec%3];
 });
 return 'ONE-SECOND DIRECTOR TIMELINE ('+duration+'s): '+
  steps.join(' | ')+'. Each cue shows actual buyer-specific action; spoken voice continues.';
}

function fitCompactSpokenCommercial(info,{inputRole='',modelTag='' }={}){
 const language=SPEECH_LANGUAGES[info.videoLanguage]||'Spanish';
 const compactAngle=angleDirectionContract({
  salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,
  castMode:info.castMode,buyerMotive:info.buyerMotive,hook:info.hook,
  creativeStyle:info.style,compactMode:true,
 });
 const fullAngle=angleDirectionContract({
  salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,
  castMode:info.castMode,buyerMotive:info.buyerMotive,hook:info.hook,
  creativeStyle:info.style,
 });
 const compactScene=compactResearchStory(info);
 const fullScene=conceptSceneContract({
  videoPrompt:info.creativeDirection,shotIdeas:info.aiShots,
  hook:info.hook,buyerMotive:info.buyerMotive,duration:info.duration,
 });
 const shortIdentity=[
  'P0 / IMMUTABLE PRODUCT SKU: '+info.product+'.',
  'The uploaded photograph is the ONLY source of exact product appearance.',
  'Keep the same physical container, scale, closure, materials, printed label,',
  'logo layout, lettering and colors in EVERY shot. No redesign, invented',
  'label, product substitution, misleading claims or synthetic packshots.',
  info.capabilities?.usesReferenceImages?'Use photo as identity REFERENCE, never the first frame.':
   info.capabilities?.imageRole==='start_frame'?'Use photo as required first frame.':'',
 ].filter(Boolean).join(' ');
 const fullIdentity=productIdentityLock(info);
 const spoken=[
  'SPOKEN SCRIPT ('+language+', target market '+info.market+'): "'+info.voice+'".',
  'SPEAK EVERY WORD verbatim, in order, with no omissions or rephrasing.',
  'Start in the first 0.2 seconds with a concrete buyer-specific hook.',
  'Maintain continuous credible speech across cuts, without silent gaps,',
  'music-only stretches or unnaturally stretched syllables.',
  'Finish the EXACT spoken buying CTA in the final second. Native lip sync',
  'only when supported by the selected video model.',
 ].join(' ');
 const identity=info.ugc?
  'REALIZO UGC: authentic vertical 9:16 smartphone video; adult presenter talks to lens for most of the runtime. No generic glamour montage, bottle rotation or silent product shots.':
  'REALIZO DEMO: authentic vertical 9:16 video demonstrating a real practical product use while a continuous narrator sells the supported benefit.';
 const cast=info.ugc?
  'CAST: keep adult actors and photographed SKU consistent. Use '+info.shots+' distinct motivated shots with speech-to-action cuts; main speaker remains visible for most of the runtime, voice continuous across inserts.':
  'CAST: use only credible adults and believable product mechanics, with natural shots tied to the narration.';
 const productLine='PRODUCT: '+info.product+'. '+sentence(info.sellerDescription,270)+'.';
 const conciseAudio='MANDATORY AUDIO: '+language+'. Opening hook → buyer need → concrete solution → real product/use → supported benefit → spoken CTA. Keep a meaningful event in every shot.';
 const timeline=buildCompactCommercialTimeline(info);
 const timelineShort=tightCommercialTimeline(info);
 const sceneShort=[
  'P0 / APPROVED CONCEPT STORYBOARD: HOOK '+sentence(info.hook,100)+'.',
  'MOTIVE '+sentence(info.buyerMotive,100)+'.',
  'PRIMARY FILMED EVENTS: '+sentence(info.creativeDirection,430)+'.',
  info.aiShots?.length?'SHOT ACTIONS: '+info.aiShots.slice(0,2).map(x=>sentence(x,110)).join(' | ')+'.':'',
  'Keep these actions in order; no generic product montage.'
 ].filter(Boolean).join(' ');
 const roles=inputRole+modelTag;
 const emergencySpeech='EXACT SPOKEN SCRIPT ('+language+'): "'+info.voice+
  '". Start in first 0.2s; say ALL words in order without silence or paraphrase; lip sync if supported; buying CTA audible at the final second.';
 const emergencySku='P0 / IMMUTABLE PRODUCT SKU: '+info.product+
  '. Uploaded photo controls the exact original container, proportions, cap, label, logo, colors and materials in EVERY shot; no substitute or redesign.';
 const emergencyRole=info.capabilities?.usesReferenceImages?
  'IMAGE REFERENCE: uploaded product photo is identity only, NOT opening frame. @image_1.':
  info.capabilities?.imageRole==='start_frame'?
  'START FRAME: animate @first_frame, retain exact original product identity.':'';
 const emergencyScene=[
  'P0 / APPROVED CONCEPT STORYBOARD: HOOK '+sentence(info.hook,75)+'.',
  'MOTIVE '+sentence(info.buyerMotive,90)+'.',
  'VISIBLE EVENTS: '+sentence(info.creativeDirection,330)+'.',
  info.aiShots?.length?'FIRST SHOT ACTION: '+sentence(info.aiShots[0],100)+'.':'',
  'Preserve researched action and reaction, no generic montage.'
 ].filter(Boolean).join(' ');
 const emergencyAngle='P0 / UNIVERSAL BUYER-ANGLE VISUAL CONTRACT: '+
  sentence(info.requestedSalesAngle||info.buyerMotive||info.angle,220)+
  '. Show credible adult body language and concrete buyer motive, not generic aesthetics.';
 const emergencyTimeline=tightCommercialTimeline(info);
 const plans=[
  [identity,spoken,productLine,fullIdentity,roles,fullAngle,fullScene,timeline,cast,conciseAudio],
  [identity,spoken,productLine,fullIdentity,roles,compactAngle,compactScene,timeline,cast,conciseAudio],
  [identity,spoken,productLine,shortIdentity,roles,compactAngle,compactScene,timeline,cast,conciseAudio],
  [identity,spoken,productLine,shortIdentity,roles,compactAngle,compactScene,timelineShort,cast,conciseAudio],
  [identity,spoken,productLine,shortIdentity,roles,compactAngle,sceneShort,timelineShort,cast,conciseAudio],
  [identity,spoken,'PRODUCT: '+info.product+'.',shortIdentity,roles,compactAngle,sceneShort,timelineShort,cast,conciseAudio],
  // The safety net protects even unusually long (but approved) speech.
  // Unlike simple slicing, ALL hard contracts and each timed action survive.
  [identity,emergencySpeech,emergencySku,emergencyRole,emergencyAngle,emergencyScene,
   emergencyTimeline,cast,'Natural filmed skin, hands, movement and light; original product; no unverified claims.'],
 ];
 const max=commercialDirectorLimit(info);
 for(const parts of plans){
  const required=parts.filter(Boolean);
  let full=required.join(' ');
  if(full.length>max)continue;
  for(const extra of [VIDEO_REALISM_RULE,'PURCHASE MOTIVE: '+info.buyerMotive+'.',
   'REAL CAMERA: physically plausible hands, skin, packaging and lighting; no CGI.']){
   if(extra&&full.length+extra.length+1<=max)full+=' '+extra;
  }
  return full;
 }
 throw Error('commercial_direction_prompt_too_long');
}

export function buildHighConversionVideoPrompt(info){
  if(info.templateId==='luxury-product-only'){
    if(info.duration!==8)throw Error('template_requires_8_seconds');
    return buildLuxuryFilmPrompt({...info,style:'premium',castMode:'product_only',audioMode:'no_voice',shots:3});
  }
  if(info.cinema&&!info.templateId)return buildLuxuryFilmPrompt(info);
  // For a master template, reuse the precise Muapi prompt instead of allowing
  // the general creative director to overwrite the fixed camera/story order.
  if(info.templateId==='ugc-vendedor')return buildLockedUgc30Prompt(info);
  const c=info.capabilities;
  const spokenHookEnd=info.salesBeats[0].end;
  const spokenCtaStart=info.salesBeats[info.salesBeats.length-1].start;
  const productOnly=info.cinema&&info.castMode==='product_only';
  const film=info.cinema;
  const sellerBuyerIntent=buyerIntent(info.sellerDescription);
  const socialScent=sellerBuyerIntent.socialScent;
  const ugcVoiceVisual=sellerBuyerIntent.bodyStriae?
    'VOICE/VISUAL STRIAE BUYER-PAIN LOCK: In the FIRST FRAME a real adult presenter speaks the hook about naturally visible stretch marks while showing a believable skin-care situation, never digitally removing marks, creating fake before-and-after results, or implying shame. As the voice explains a skin-care/massage routine, show only physically plausible body-care actions and introduce the actual product when its name is spoken. Maintain visible natural skin texture, continuous narration and a direct-to-camera spoken CTA at the end. NO unverified promise that cream removes stretch marks.':
    socialScent?
    'VOICE/VISUAL BUYER-PAIN LOCK: First frame shows an adult presenter getting ready before going out, facing the lens and talking about overlooking personal scent and wanting a good impression. Show the actual wash/product when the spoken solution introduces it; return to lens for CTA. NO fictional female compliments, attraction reactions or unsupported effects. Sell scent and self-presentation, not a photographed bottle.':
    'VOICE/VISUAL BUYER-PAIN LOCK: First frame visibly acts the specific buyer problem spoken in the FIRST HOOK. The actor speaks the hook while experiencing the friction, demonstrates the solution while explaining it, shows the product when naming it, and ends facing the lens for the buying CTA. The visuals must never become an unrelated product montage.';
  const stages=info.ugc
    ? 'UGC SPEECH-LINKED MULTI-SCENE SCHEDULE: 0-'+spokenHookEnd+'s speaker says a concise compelling hook TO LENS immediately; '+
      spokenHookEnd+'-'+spokenCtaStart+'s same speaker explains the need and product benefits with '+info.shots+' motivated changes of scene, actor reaction and product use timed to spoken phrases; keep most speech on face and voice continuing through inserts; '+
      spokenCtaStart+'-'+info.duration+'s clear spoken CTA. Max '+info.shots+' shots, no standalone product montage and no silent packaging close-up. '+ugcVoiceVisual
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
  const modelTag=String(info.modelId||'').startsWith('kling-4.0-')?
    info.workflowId==='references'?' Mention the uploaded product reference as @image_1 throughout the planned scene.':
    info.workflowId==='animate_image'?' The uploaded still is @first_frame; animate it as the opening frame.':'' :'';
  // Kling 4.0 receives a deliberately concise, high-signal director from
  // the start. The old 7.9k assembly looked valid to our own length gate
  // yet could be rejected by the provider. Protect dialogue, sales motive,
  // filmed actions, one-second choreography and photographed packaging.
  if(String(info.modelId||'').startsWith('kling-4.0-')&&
    (info.ugc||info.style==='demo'))
    return fitCompactSpokenCommercial(info,{inputRole,modelTag});
  const styleGuide=FORMAT_GUIDES[info.style];
  const formatIdentity=info.ugc
    ?'UGC SALES REVIEW: authentic, brisk direct-to-camera sales presentation. Face and speaking performance visible 70-85% of runtime; never fake a personal testimonial. VOICE-FIRST EDITING: voice NEVER stops for cutaways. Phone-native jump cuts, no glossy cinematic transitions; no staged pauses or unnaturally slow delivery.'
    :info.style==='cinematic'
    ?'CINEMATOGRAPHIC: believable cause-effect microstory and motivated actions, not UGC or packshot slideshow.'
    :info.style==='premium'
    ?'PREMIUM COMMERCIAL: tactile materials, real product use and understated aspirational value, not CGI or fake luxury.'
    :'PRODUCT DEMONSTRATION: explain real problem then show actual operation step by step, never fabricated results.';
  const actualTemplate=getAdTemplate(info.templateId);
  const lockedDirection=actualTemplate?templateDirection(actualTemplate.id,info.duration,{
   actor:info.templateActor,setting:info.templateSetting}):'';
  // Long speech already consumes most of the provider prompt budget. Embed the
  // angle and selected action in the mandatory PRODUCT section instead of
  // introducing new P0 sections that would displace authorized narration.
  const longForm=info.duration>=30;
  const longFormBuyerAngle=longForm?(' BUYER-ANGLE SCENE MUST SHOW: '+sentence(info.requestedSalesAngle||info.buyerMotive||info.angle,140)+'. FIRST REAL ACTION: '+sentence(info.creativeDirection||info.hook,180)+'. Format '+info.style+' affects cinematography, not commercial motive.'):'';
  const universalAngle=longForm?'':angleDirectionContract({salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,castMode:info.castMode,buyerMotive:info.buyerMotive,hook:info.hook,creativeStyle:info.style});
  // UGC stays voice-first. Do not let an imported shot list undo speaker
  // timing, lip-sync or the spoken solution; its hook/motive still carry the angle.
  const universalScene=longForm?'':conceptSceneContract({videoPrompt:info.ugc?'':info.creativeDirection,shotIdeas:info.ugc?[]:info.aiShots,hook:info.hook,buyerMotive:info.buyerMotive,duration:info.duration});
  const instructions=[
    'COMMERCIAL AD, realistic live-action vertical 9:16. Premium film is not UGC, a presenter review, a bottle animation or a slideshow.',
    VIDEO_REALISM_RULE,
    castDirection(info.style,info.castMode),
    info.ugc?'MODEL-AGNOSTIC SPOKEN UGC AUDIO PERFORMANCE: For this '+info.duration+'-second commercial in '+SPEECH_LANGUAGES[info.videoLanguage]+', start speaking within the first 0.2 seconds and continue with energetic natural dialogue until the final spoken CTA near the end. Voice should occupy approximately 90–98% of the chosen runtime, with a brisk but intelligible cadence matching the '+info.voiceBudget.target+'-word budget. No long pauses, drawn-out vowels, empty reaction shots, mute cutaways or music-only intros/outros; natural micro-breaths only. Do not alter authorized dialogue. Synchronize lips when native speech/lip-sync is supported by the selected model. These are editorial directions for any chosen model, not a promise that its endpoint generates audio.': film?'PREMIUM FILM AUDIO: Atmospheric original music and precise realistic foley lead; optional very short OFF-CAMERA voiceover only if it serves the scene. No direct-to-camera dialogue, no mandatory narration, no long spoken sales pitch and no artificial testimonial.':'MODEL-AGNOSTIC DEMO / PROBLEM-SOLUTION AUDIO: When narration is requested and the selected model supports speech, start the voice immediately and keep narration running across product demonstrations until the final spoken CTA. Use a brisk, intelligible delivery that fills nearly the selected '+info.duration+' seconds. No long silences, idle shots, slow syllables or music-only inserts. Preserve the approved wording; if audio is unsupported, do not claim native speech is available.',
    'MANDATORY AUDIO LANGUAGE: '+SPEECH_LANGUAGES[info.videoLanguage]+'. All dialogue, narration and spoken CTA must be in '+SPEECH_LANGUAGES[info.videoLanguage]+'.',
    'NMF SALES STORY: '+SALES_STRUCTURES[info.style]+' '+(info.ugc||info.style==='demo'?'EXACT SPOKEN PERSUASION ORDER: '+SPOKEN_SALES_SEQUENCE+'. The SOLUTION is intelligible before the PRODUCT name, and the product is explicitly tied to that solution. Neither the hook nor the problem may consume most of the short video. ':'')+'Never start as a catalogue or invent efficacy or testimonials.',
    'SECOND-BY-SECOND SELLING PLAN ('+info.duration+'s): '+info.salesBeats.map(b=>b.start+'-'+b.end+'s '+b.name).join(' | ')+'. Every shot serves the product and purchase motive.',
    'PRODUCT: '+info.product+'. Seller description: '+info.sellerDescription+'.'+longFormBuyerAngle,
    !film?'SPOKEN SCRIPT ('+SPEECH_LANGUAGES[info.videoLanguage]+', target market '+info.market+'): "'+info.voice+'". SPEAK EVERY WORD verbatim, in order, from the opening buyer-pain hook to the final spoken CTA. Never narrate the photograph, label or product category; the words and actions must tell ONE story. No omissions, filler, rephrasing or silent stretches. If the selected model supports speech, synchronize actor lip movement naturally; do not claim lip-sync on unsupported models.':'FILM VOICE POLICY: Do not turn the research spoken_script into a presenter monologue. Convey the idea VISUALLY using props, gestures, real product use and elegant motion; optional succinct off-camera voiceover in '+SPEECH_LANGUAGES[info.videoLanguage]+' only when helpful. Final CTA must remain a clear creative action, not hallucinated readable lettering.',
    lockedDirection,
    inputRole+modelTag,
    productGeometryPrompt(info.productGeometry),
    'HOOK TIMING — HARD EDITORIAL RULE: First 0-'+spokenHookEnd+'s maximum; 3 seconds is the absolute maximum, then advance to buyer problem/desire and product solution. Stop the scroll at frame one; no logo intro or silent establishing shot.',
    formatIdentity,
    'FORMAT CONTRACT '+info.style.toUpperCase()+': '+styleGuide.structure+'. CAMERA: '+styleGuide.camera+'.',
    'STYLE-SPECIFIC POSTPRODUCTION & FINISHING: EDITING: '+styleGuide.editing+'. TRANSITIONS: '+styleGuide.transitions+'. EFFECTS: '+styleGuide.effects+'. SOUND DESIGN: '+styleGuide.sound_design+'. Edits must support story, physical realism and purchase motive; they are generator directions, not separately guaranteed editing.',
    !film?'SPEECH DENSITY / RUNTIME CHECK: Script contains '+info.voice.trim().split(/\s+/).filter(Boolean).length+' words; target '+info.voiceBudget.target+' words, usable range '+info.voiceBudget.minimum+'–'+info.voiceBudget.maximum+' for the SELECTED '+info.duration+'-second runtime. Speech must occupy nearly the whole video, regardless of the video model chosen. Use energetic natural articulation rather than stretching sparse words across the clip. Speak continuously over cutaways and deliver the CTA at the end. For unsupported speech-capability models this is a creative instruction, not an available audio feature.':'FILM PACING: concise visual beats, intentional product reveal, professional optical transitions when multi-shot, and sound/music composition. Dialogue is NOT required.',
    'SALES ANGLE: '+info.angle+'. CUSTOMER-CHOSEN BUYING MOTIVE: '+(info.requestedSalesAngle||'use evidence-led motive')+'. PURCHASING MOTIVE: '+info.buyerMotive+'. RESEARCHED CLAIMS: '+info.researchedClaims.join('; ')+'. Hook: '+(info.hook||'a relatable need')+'.',
    'DIRECTED SHOT TIMING: '+stages,
    'CTA: '+info.cta+'.',
    'SHOT DESIGN: '+info.shots+' coordinated '+(info.shots===1?'continuous take':'shots')+' within '+info.duration+' seconds. '+(productOnly?'Product, physical scale, labels and lighting':'Actor, product, wardrobe and lighting')+' stay consistent; transitions move the commercial story forward.',
    'REALISM: natural skin, face, lips and hand grip, authentic material reflections, camera continuity, accurate bottle geometry and labels. No invented readable lettering, exaggerated effects or CGI floating packaging.',
    'AUDIO & FINISH: authentic foley, professional music mix, coherent color grading and '+(info.shots===1?'continuous optical movement':'motivated cuts')+'. '+(film?'Music and tactile sound may carry the film without speech.':'Sound stays beneath important narration.')+' '+c.videoQualityGuide+'.',
    !info.ugc&&!productOnly&&info.creativeDirection?'APPROVED CREATIVE DIRECTION (only when consistent with cast choice and no UGC): '+info.creativeDirection+'.':'',
    !info.ugc&&!productOnly&&info.aiShots.length?'RESEARCHED SHOT IDEAS (reinterpret as non-UGC film): '+info.aiShots.join(' | ')+'.':'',
    buildHyperrealCommercialDirection(info),
    productIdentityLock(info),
    universalAngle,
    universalScene,
  ];
  // Assemble whole sections in priority order. A blind slice previously
  // cut a video's spoken CTA and the audio pacing instruction mid-word.
  // Keep the exact approved dialogue, timing, CTA and product identity before
  // optional finishing details; never truncate a sentence or a speaker cue.
  // The authorized spoken script is mandatory for any audio-led format,
  // even at 120 seconds. Visual embellishments may be dropped instead.
  // Resolve mandatory sections by their stable labels, NOT hard-coded
  // positions. Adding one new director block must never invalidate paid video
  // requests or silently drop an approved dialogue/CTA.
  const identityIndex=instructions.findIndex(x=>typeof x==='string'&&x.startsWith('P0 / IMMUTABLE PRODUCT SKU'));
  const timelineIndex=instructions.findIndex(x=>typeof x==='string'&&x.includes('ONE-SECOND DIRECTOR TIMELINE'));
  const angleIndex=instructions.indexOf(universalAngle);
  const sceneIndex=instructions.indexOf(universalScene);
  // Immutable dialogue, timing and SKU remain ahead of new buyer-angle data.
  // The former priority dropped these essential UGC blocks to fit an angle.
  const salesStoryIndex=instructions.findIndex(x=>typeof x==='string'&&x.startsWith('NMF SALES STORY:'));
  const hyperrealIndex=instructions.findIndex(x=>typeof x==='string'&&x.includes('ONE-SECOND DIRECTOR TIMELINE'));
  const priority=[8,7,identityIndex,10,4,19,3,6,timelineIndex,salesStoryIndex,
    hyperrealIndex,1,16,angleIndex,sceneIndex,18,12,13,0,2,11,14,15,17,20,21,22,9,23,24]
    .filter((i,pos,all)=>i>=0&&all.indexOf(i)===pos);
  const kept=[];
  let used=0;
  const maxPromptLength=commercialDirectorLimit(info);
  for(const i of priority){
    const block=instructions[i];
    if(!block)continue;
    const extra=block.length+(kept.length?1:0);
    if(used+extra>maxPromptLength)continue;
    kept.push(block);
    used+=extra;
  }
  const visualContractsIntact=identityIndex>=0&&timelineIndex>=0&&
    kept.includes(instructions[identityIndex])&&kept.includes(instructions[timelineIndex])&&
    (longForm||(kept.includes(universalAngle)&&kept.includes(universalScene)));
  const spokenContractsIntact=info.cinema||!info.voice||
    (kept.includes(instructions[8])&&kept.includes(instructions[19]));
  if(!visualContractsIntact||!spokenContractsIntact){
    if(!info.cinema&&(info.ugc||info.style==='demo'))
      return fitCompactSpokenCommercial(info,{inputRole,modelTag});
    throw Error(!visualContractsIntact?'commercial_direction_prompt_too_long':
      'spoken_script_prompt_too_long');
  }
  return kept.join(' ');
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,videoLanguage='es',modelId,workflowId=null,duration=8,imageProvided=true,style='auto',shotPreference='auto',castMode='with_people',audioMode='no_voice',productGeometry=null,templateId=null,templateActor='hombre',templateSetting='auto',templateChangeRequest='',promptMaxLength=12500
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,videoLanguage,modelId,workflowId,duration,imageProvided,style,shotPreference,castMode,audioMode,productGeometry});
  plan.templateId=getAdTemplate(templateId)?.id||null;
  plan.templateActor=templateActor;
  plan.templateSetting=templateSetting;
  plan.templateChangeRequest=templateChangeRequest;
  plan.promptMaxLength=promptMaxLength;
  plan.modelId=modelId;
  plan.workflowId=workflowId;
  const prompt=buildHighConversionVideoPrompt(plan);
  return {
    prompt,spoken_script:plan.cinema&&plan.audioMode==='no_voice'?'':plan.voice,hook:plan.hook,cta:plan.cta,
    video_language:plan.videoLanguage,
    template_id:plan.templateId,
    cinematic:plan.cinema,creative_style:plan.style,cast_mode:plan.castMode,audio_mode:plan.audioMode,shot_count:plan.shots,
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
