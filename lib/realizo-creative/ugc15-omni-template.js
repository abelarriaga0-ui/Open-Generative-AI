// Realizo reusable UGC template derived from a completed 15s Muapi video.
// The source video is a preview/creative benchmark, NEVER a generative video
// reference. New customer product image replaces @image1 on every request.
export const UGC15_TEMPLATE_ID='ugc-15-omni-voz-continua';
export const UGC15_TEMPLATE_MODEL_ID='seedance-2-omni-reference';
export const UGC15_TEMPLATE_DURATION=15;
export const UGC15_TEMPLATE_RESOLUTION='720p';
export const UGC15_TEMPLATE_QUALITY='high';
export const UGC15_TEMPLATE_ASPECT_RATIO='9:16';
export const UGC15_TEMPLATE_WORKFLOW='references';
export const UGC15_TEMPLATE_SAMPLE_URL='https://cdn.muapi.ai/outputs/generated/79536355-4c03-4dd8-9532-9a25bb7d0893_4729d053.mp4';
export const UGC15_TEMPLATE_SAMPLE_EXPIRES='2026-12-04T02:38:40.262Z';

const clean=(s,max)=>String(s??'').replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const actors={hombre:'adult male presenter',mujer:'adult female presenter'};
export function makeUgc15ReferenceInput({
 productName='',description='',spokenScript='',buyerMotive='',angle='',
 products=[],imageUrl='',actor='hombre',setting='auto',changeRequest='',market='EC'
}={}){
 const product=clean(productName,100);
 const desc=clean(description,360);
 const voice=clean(spokenScript,790);
 const words=voice.split(/\s+/).filter(Boolean).length;
 const chosenActor=actors[actor]||actors.hombre;
 const place=clean(setting,125);
 const changes=clean(changeRequest,350);
 const motive=clean(buyerMotive,160);
 const intent=clean(angle,120);
 if(!product||desc.length<15||!/^https:\/\//.test(imageUrl)||imageUrl.length>1400||
   words<30||words>58)throw Error('invalid_ugc15_template_payload');
 const visible=Array.isArray(products)?products.slice(0,4).map(p=>
  [clean(p?.name,50),clean(p?.container_type,45),clean(p?.body_shape,65),
   clean(p?.closure_type,45),clean(p?.main_colors,55)].filter(Boolean).join(' / ')
 ).filter(Boolean).join(' | '):'';
 const prompt=[
  'REALIZO UGC DIRECT-RESPONSE MASTER TEMPLATE — 15 SECONDS, vertical 9:16, photoreal live-action, real smartphone footage.',
  'SPOKEN SCRIPT (Spanish, target market '+clean(market,12)+'): "'+voice+'". SPEAK EVERY WORD verbatim in order. Start in the first 0.2 seconds; deliver the final spoken CTA at the very end. Natural energetic voice with no dead air or music-only stretches; continuous speech across cuts. Around 40–46 natural Spanish words preferred for this 15-second format.',
  'REFERENCE @image1: the uploaded product photo determines only the real product appearance, packaging, shape, materials and labeling. Do NOT use it as the first frame. Shoot a NEW scene with a real adult presenter. No bottle rotation, slideshow or invented brand lettering.',
  'PRODUCT: '+product+'. Seller description: '+desc+'. Buyer motive: '+(motive||'derived from product purpose')+'. Sales angle: '+(intent||'benefit actually supported by product')+'.',
  'NARRATIVE LOCK: buyer-centred HOOK -> recognizable PROBLEM or DESIRE -> concrete SOLUTION -> PRODUCT as the practical way to use that solution -> visible USAGE or supported BENEFIT -> clear spoken CTA. The problem and solution must not be replaced by catalogue descriptions. Do not invent clinical outcomes, testimonials or guaranteed results.',
  'TIMED STORYBOARD 15s: 0–2.2s immediate spoken hook to lens; 2.2–4.9s concrete buyer need; 4.9–6.9s solution explained; 6.9–11s introduce product while showing believable use; 11–12.6s demonstrate a supported relevant detail; 12.6–15s persuasive spoken CTA. Narration continues until the final moment.',
  'UGC VISUAL LOCK: exactly one adult presenter ('+chosenActor+'), close to a real smartphone camera, face and believable lip motion visible for roughly 70–85% of runtime; at most two coordinated natural shots and one very brief product cutaway with uninterrupted speech. Real skin texture, natural hand micro-movements and direct eye contact. Presenter acts in '+(place==='auto'?'a suitable lived-in everyday environment':place)+'.',
  'SPANISH AUDIO LOCK: all narration and CTA in Spanish. No filler, unusually slow delivery, prolonged breaths or stretched vowels. Keep audio clear and synchronized when native speech is supported by this engine; the prompt cannot guarantee a provider feature.',
  'REALIZO REALISM: preserve the exact product silhouette, closure, print and relative scale. Authentic skin, shadows, gravity and natural highlights; no floating objects, waxy faces, deformed hands, synthetic CGI gloss or changing labels. Camera motion and cuts remain physically plausible.',
  ...(visible?['VISUAL PRODUCT IDENTIFICATION FROM REFERENCE: '+visible+'. Do not invent missing details.']:[]),
  ...(changes?['CUSTOMER-REQUESTED CHANGES to the acting/setting only, while keeping 15s UGC sales structure: '+changes+'.']:[]),
  'FINISH: naturally recorded smartphone portrait video, restrained color, crisp spoken voice, background effects below speech. Do not turn this UGC performance into a luxury product-only film.'
 ].join(' ');
 if(prompt.length>5700)throw Error('invalid_ugc15_template_prompt');
 return {
  template_id:UGC15_TEMPLATE_ID,
  model_id:UGC15_TEMPLATE_MODEL_ID,
  input:{
   prompt,images_list:[imageUrl],video_files:null,audio_files:null,
   aspect_ratio:UGC15_TEMPLATE_ASPECT_RATIO,quality:UGC15_TEMPLATE_QUALITY,
   duration:UGC15_TEMPLATE_DURATION,resolution:UGC15_TEMPLATE_RESOLUTION
  }
 };
}
