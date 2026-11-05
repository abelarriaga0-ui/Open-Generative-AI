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
import {buildHyperrealCommercialDirection} from './hyperreal-commercial.js';
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
export function planSalesVideo({concept={},productName='',description='',cta='',market='EC',videoLanguage='es',duration=8,modelId='',workflowId=null,imageProvided=true,style='auto',shotPreference='auto',castMode='with_people',audioMode='no_voice',productGeometry=null}={}){
  const angle=sentence(concept.angle||'benefits',40).toLowerCase();
  const requestedSalesAngle=sentence(concept.requested_sales_angle||'',240);
  const salesAngleCode=sentence(concept.sales_angle_code||'auto',250);
  const salesStyle=style==='auto'?
    (CREATIVE_FORMATS.includes(concept.creative_style)?concept.creative_style:
     /(ugc|problem|testimonial|benefit|direct|demo)/i.test(angle+' '+concept.name)?'ugc':'cinematic'):
    selectedStyle(style,concept.creative_style);
  const ugc=salesStyle==='ugc';
  const cinema=salesStyle==='cinematic'||salesStyle==='premium';
  const seconds=Math.max(1,Math.min(120,Number(duration)||8));
  const maxShots=seconds<=6?2:seconds<=9?3:seconds<=15?5:seconds<=30?7:Math.min(12,Math.ceil(seconds/4));
  // UGC is a spoken presentation, not a mute montage. Scale shot count with duration.
  const allowedShots=ugc?Math.min(maxShots,seconds<=6?1:seconds<=15?2:seconds<=30?3:5):maxShots;
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
    angle,requestedSalesAngle,salesAngleCode,ugc,market,videoLanguage:SPEECH_LANGUAGES[videoLanguage]?videoLanguage:'es',product,sellerDescription,hook,voice,cta:finalCta,
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
  const sound=filmAudioDirection(info.audioMode,info.castMode,info.videoLanguage,info.voice)+ ' Professional film mix with music and physical foley, no unverified before/after claims. End with a composition suitable for a later editable CTA overlay, never ask the generator to spell a slogan.';
  const identity=info.imageProvided
    ? info.capabilities.usesReferenceImages
      ? 'REFERENCE PRODUCT PHOTOGRAPH defines exact identity, colors, silhouette, cap and layout. IMAGE IS NOT FIRST FRAME. Start in a newly art-directed studio environment, not the source photo; preserve visual identity with no invented readable text.'
      : info.capabilities.imageRole==='start_frame'
        ? 'TECHNICAL LIMITATION: model uses supplied photograph as first frame. Preserve product identity; do not reinterpret it as an image-reference input.'
        : 'PRODUCT IDENTITY: base appearance on supplied product description only; avoid inventing label words.'
    : 'NO PRODUCT IMAGE: do not invent readable labels or unverified product materials.';
  const angleContract=angleDirectionContract({
    salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,
    castMode:info.castMode,buyerMotive:info.buyerMotive,hook:info.hook,
    creativeStyle:info.style,
  });
  const sceneContract=conceptSceneContract({
    videoPrompt:info.creativeDirection,shotIdeas:info.aiShots,
    hook:info.hook,buyerMotive:info.buyerMotive,duration:info.duration,
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
  if(complete.length>12500)throw Error('commercial_direction_prompt_too_long');
  return complete;
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
    ? 'UGC TALKING-HEAD SCHEDULE: 0-'+spokenHookEnd+'s speaker says a concise compelling hook TO LENS immediately; '+
      spokenHookEnd+'-'+spokenCtaStart+'s same speaker explains the need and product benefits, with at most one brief insert while voice continues; '+
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
  const universalAngle=angleDirectionContract({salesAngle:info.salesAngleCode,requestedSalesAngle:info.requestedSalesAngle,castMode:info.castMode,buyerMotive:info.buyerMotive,hook:info.hook,creativeStyle:info.style});
  // UGC stays voice-first. Do not let an imported shot list undo speaker
  // timing, lip-sync or the spoken solution; its hook/motive still carry the angle.
  const universalScene=conceptSceneContract({videoPrompt:info.ugc?'':info.creativeDirection,shotIdeas:info.ugc?[]:info.aiShots,hook:info.hook,buyerMotive:info.buyerMotive,duration:info.duration});
  const instructions=[
    'COMMERCIAL AD, realistic live-action vertical 9:16. Premium film is not UGC, a presenter review, a bottle animation or a slideshow.',
    VIDEO_REALISM_RULE,
    castDirection(info.style,info.castMode),
    info.ugc?'MODEL-AGNOSTIC SPOKEN UGC AUDIO PERFORMANCE: For this '+info.duration+'-second commercial in '+SPEECH_LANGUAGES[info.videoLanguage]+', start speaking within the first 0.2 seconds and continue with energetic natural dialogue until the final spoken CTA near the end. Voice should occupy approximately 90–98% of the chosen runtime, with a brisk but intelligible cadence matching the '+info.voiceBudget.target+'-word budget. No long pauses, drawn-out vowels, empty reaction shots, mute cutaways or music-only intros/outros; natural micro-breaths only. Do not alter authorized dialogue. Synchronize lips when native speech/lip-sync is supported by the selected model. These are editorial directions for any chosen model, not a promise that its endpoint generates audio.': film?'PREMIUM FILM AUDIO: Atmospheric original music and precise realistic foley lead; optional very short OFF-CAMERA voiceover only if it serves the scene. No direct-to-camera dialogue, no mandatory narration, no long spoken sales pitch and no artificial testimonial.':'MODEL-AGNOSTIC DEMO / PROBLEM-SOLUTION AUDIO: When narration is requested and the selected model supports speech, start the voice immediately and keep narration running across product demonstrations until the final spoken CTA. Use a brisk, intelligible delivery that fills nearly the selected '+info.duration+' seconds. No long silences, idle shots, slow syllables or music-only inserts. Preserve the approved wording; if audio is unsupported, do not claim native speech is available.',
    'MANDATORY AUDIO LANGUAGE: '+SPEECH_LANGUAGES[info.videoLanguage]+'. All dialogue, narration and spoken CTA must be in '+SPEECH_LANGUAGES[info.videoLanguage]+'.',
    'NMF SALES STORY: '+SALES_STRUCTURES[info.style]+' '+(info.ugc||info.style==='demo'?'EXACT SPOKEN PERSUASION ORDER: '+SPOKEN_SALES_SEQUENCE+'. The SOLUTION is intelligible before the PRODUCT name, and the product is explicitly tied to that solution. Neither the hook nor the problem may consume most of the short video. ':'')+'Never start as a catalogue or invent efficacy or testimonials.',
    'SECOND-BY-SECOND SELLING PLAN ('+info.duration+'s): '+info.salesBeats.map(b=>b.start+'-'+b.end+'s '+b.name).join(' | ')+'. Every shot serves the product and purchase motive.',
    'PRODUCT: '+info.product+'. Seller description: '+info.sellerDescription+'.',
    !film?'SPOKEN SCRIPT ('+SPEECH_LANGUAGES[info.videoLanguage]+', target market '+info.market+'): "'+info.voice+'". SPEAK EVERY WORD verbatim, in order, from the opening buyer-pain hook to the final spoken CTA. Never narrate the photograph, label or product category; the words and actions must tell ONE story. No omissions, filler, rephrasing or silent stretches. If the selected model supports speech, synchronize actor lip movement naturally; do not claim lip-sync on unsupported models.':'FILM VOICE POLICY: Do not turn the research spoken_script into a presenter monologue. Convey the idea VISUALLY using props, gestures, real product use and elegant motion; optional succinct off-camera voiceover in '+SPEECH_LANGUAGES[info.videoLanguage]+' only when helpful. Final CTA must remain a clear creative action, not hallucinated readable lettering.',
    lockedDirection,
    inputRole,
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
  const maxPromptLength=12500;
  for(const i of priority){
    const block=instructions[i];
    if(!block)continue;
    const extra=block.length+(kept.length?1:0);
    if(used+extra>maxPromptLength)continue;
    kept.push(block);
    used+=extra;
  }
  if(identityIndex<0||timelineIndex<0||!kept.includes(instructions[identityIndex])||!kept.includes(instructions[timelineIndex])||!kept.includes(universalAngle)||!kept.includes(universalScene))throw Error('commercial_direction_prompt_too_long');
  if(!info.cinema && info.voice && (!kept.includes(instructions[8])||!kept.includes(instructions[19])))
    throw Error('spoken_script_prompt_too_long');
  return kept.join(' ');
}
export function buildCommercialDirectorPackage({
  concept,productName,description,cta,market,videoLanguage='es',modelId,workflowId=null,duration=8,imageProvided=true,style='auto',shotPreference='auto',castMode='with_people',audioMode='no_voice',productGeometry=null,templateId=null,templateActor='hombre',templateSetting='auto',templateChangeRequest=''
}={}){
  const plan=planSalesVideo({concept,productName,description,cta,market,videoLanguage,modelId,workflowId,duration,imageProvided,style,shotPreference,castMode,audioMode,productGeometry});
  plan.templateId=getAdTemplate(templateId)?.id||null;
  plan.templateActor=templateActor;
  plan.templateSetting=templateSetting;
  plan.templateChangeRequest=templateChangeRequest;
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
