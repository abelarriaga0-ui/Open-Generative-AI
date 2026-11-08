// Automatic one-time speech repair for an already-funded Premium research.
// It does NOT repeat web research, submit video jobs or change wallet ledgers.
// This is an internal Realizo service cost; never charge the customer for it.
import {selectedStyle} from './format-guides.js';
import {isFilmStyle} from './cast-mode.js';
import {normalizeAudioMode} from './audio-mode.js';
import {scriptReadiness,spokenHook,voiceBudget,MAX_SPOKEN_SCRIPT_CHARACTERS} from './sales-storyboard.js';
import {salesAngleDirective} from './sales-angle.js';

const clean=(v,max)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
export function premiumPolishNeed(project,concept){
 if(!project||!concept||Number(project.video_duration_seconds)<20)return null;
 const style=selectedStyle(project.creative_style,concept.creative_style);
 if(isFilmStyle(style)&&normalizeAudioMode(project.audio_mode)==='no_voice')return null;
 const speech=clean(concept.spoken_script||concept.script,MAX_SPOKEN_SCRIPT_CHARACTERS);
 const readiness=scriptReadiness(speech,{
  seconds:Number(project.video_duration_seconds),style,description:project.description||''
 });
 // Generic inspirational slogans are often too weak for the first 2 seconds,
 // despite looking attractive as a static headline.
 const hook=spokenHook(speech);
 const slogan=/^(?:que tu|deja que|haz que|tu (?:llegada|estilo|historia|esencia)|cada detalle|el detalle (?:importa|cuenta)|vive (?:el|la)|un toque (?:de|que))/i.test(hook);
 if(!readiness.tooShort&&!readiness.tooLong&&!readiness.qualityIssues.length&&!slogan)return null;
 return {style,speech,readiness,slogan};
}
export function validatePremiumPolish(script,project,concept){
 const need=premiumPolishNeed(project,concept);
 const style=selectedStyle(project.creative_style,concept.creative_style);
 const normalized=clean(script,MAX_SPOKEN_SCRIPT_CHARACTERS+1);
 if(!normalized||normalized.length>MAX_SPOKEN_SCRIPT_CHARACTERS)
  throw Error('premium_polish_invalid_script');
 const readiness=scriptReadiness(normalized,{
  seconds:project.video_duration_seconds,style,description:project.description||''
 });
 if(readiness.tooShort||readiness.tooLong||readiness.qualityIssues.length)
  throw Error('premium_polish_invalid_script');
 if(/^(?:que tu|deja que|haz que|cada detalle|tu llegada|tu estilo)/i.test(spokenHook(normalized)))
  throw Error('premium_polish_weak_hook');
 return {speech:normalized,words:readiness.words,budget:voiceBudget(project.video_duration_seconds,style),previousNeed:need};
}
export async function polishPremiumSpeechWithAI(env,project,concept){
 if(!env.OPENAI_API_KEY||!env.OPENAI_PREMIUM_MODEL)throw Error('premium_polish_not_configured');
 const need=premiumPolishNeed(project,concept);
 if(!need)return clean(concept.spoken_script||concept.script,MAX_SPOKEN_SCRIPT_CHARACTERS);
 const budget=need.readiness.budget;
 const context={
  product:clean(project.product_name,100),
  description:clean(project.description,900),
  market:clean(project.market_code,8),
  language:clean(project.video_language||'es',6),
  angle:clean(salesAngleDirective(project.sales_angle)||project.sales_angle,300),
  style:need.style,seconds:Number(project.video_duration_seconds),
  hook:clean(concept.hook,160),
  motive:clean(concept.buyer_motive||concept.reason,420),
  cta:clean(concept.cta||project.cta,130),
  current_speech:need.speech,
  visual_idea:clean(concept.video_prompt,850),
  verified_facts:Array.isArray(concept.key_evidence_claims)?
   concept.key_evidence_claims.slice(0,4).map(v=>clean(v,150)):[],
 };
 const response=await fetch('https://api.openai.com/v1/responses',{
  method:'POST',
  headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},
  body:JSON.stringify({
   model:env.OPENAI_PREMIUM_MODEL,store:false,
   max_output_tokens:4200,reasoning:{effort:'low'},
   instructions:[
    'You are the final sales COPY EDITOR for a professional real-life video ad.',
    'The customer already paid for the original research. DO NOT perform a new search.',
    'Produce ONE complete, specific, naturally speakable '+context.language+' narration of '+budget.minimum+'–'+budget.maximum+' words, ideally '+budget.target+' words, for exactly '+context.seconds+' seconds.',
    'First 2–3 seconds: concise disruptive spoken HOOK with a concrete buyer desire, friction or surprising situation rooted in the customer-selected sales angle. No interchangeable inspirational slogan, no generic elegant slogan, no empty brand-intro.',
    'Continue in connected sentences: actual buyer desire -> specific useful idea -> truthful product mention in a practical role -> feasible supported use/benefit -> EXACT clear spoken CTA at the end. Do not fill time with repetition.',
    'Preserve the actual product and the seller-selected angle. Do not substitute the product or change the sales strategy to generic premium aesthetics.',
    'Do not invent guaranteed attraction, a medical cure, statistics, testimonials, fake scarcity or any characteristic absent from the data.',
    'If the chosen format is premium or cinema with voiceover, write OFF-SCREEN cinematic narration, NOT a talking-head influencer monologue. If the format is UGC, write credible direct-to-camera natural speech.',
    'Do NOT output stage directions, overlays, text labels or quotation marks around narration. Only JSON according to the schema.'
   ].join(' '),
   input:[{role:'user',content:JSON.stringify(context)}],
   text:{format:{type:'json_schema',name:'realizo_spoken_copy_quality_v1',strict:true,
    schema:{type:'object',additionalProperties:false,
     properties:{spoken_script:{type:'string'}},required:['spoken_script']}
   }},
  }),
  signal:AbortSignal.timeout(45000),
 });
 if(!response.ok)throw Error('premium_polish_provider_unavailable');
 const result=await response.json();
 if(result.status!=='completed')throw Error('premium_polish_provider_incomplete');
 const output=(result.output||[]).flatMap(x=>x.type==='message'?x.content||[]:[])
  .filter(x=>x.type==='output_text').map(x=>x.text).join('');
 let obj;
 try{obj=JSON.parse(output)}catch{throw Error('premium_polish_invalid_json')}
 return validatePremiumPolish(obj.spoken_script,project,concept).speech;
}
