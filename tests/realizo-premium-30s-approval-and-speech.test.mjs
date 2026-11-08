import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {voiceBudget,scriptReadiness,speechWords} from '../lib/realizo-creative/sales-storyboard.js';
import {filmAudioDirection} from '../lib/realizo-creative/audio-mode.js';
import {premiumPolishNeed,validatePremiumPolish,polishPremiumSpeechWithAI} from '../lib/realizo-creative/premium-speech-polish.js';

const original=[
 'Que tu llegada diga más. Antes de acercarte, elige cada detalle: postura,',
 'mirada y un aroma que acompañe tu estilo. Un producto real completa ese ritual.',
 'Si quieres tener un aroma inolvidable, escríbenos y pide el tuyo ahora.'
].join(' ');
const project={
 product_name:'Producto de prueba',description:'Accesorio de cuidado personal de uso cotidiano, aroma personal y presentación elegante.',
 sales_angle:'confidence',creative_style:'premium',cast_mode:'with_people',audio_mode:'voiceover',
 video_duration_seconds:30,market_code:'EC',video_language:'es',cta:'Escríbenos para pedir el tuyo.'
};
const longNarration=[
 '¿Y si el detalle que olvidaste fuera el más personal? Antes de salir, eliges',
 'cómo vestirte, cómo caminar y qué impresión quieres dejar cuando te acercas',
 'a alguien. También puedes elegir un aroma que combine con tu estilo.',
 'Por eso incorpora Producto de prueba en tu preparación cotidiana. Es',
 'un accesorio de cuidado personal pensado para acompañar ese momento.',
 'Úsalo como parte de tu propia rutina y decide cómo quieres presentarte.',
 'Escríbenos para conocerlo y pedir el tuyo hoy.'
].join(' ');
test('long spoken Premium has a natural 30-second word budget',()=>{
 const b=voiceBudget(30,'premium');
 assert.ok(b.minimum>=65&&b.minimum<=75);
 assert.ok(b.maximum>=83&&b.maximum<=89);
 assert.ok(voiceBudget(8,'premium').maximum<30,'8s premium remains short');
 assert.ok(speechWords(original)<b.minimum,'Original 41-word copy is underwritten');
 const fix=premiumPolishNeed(project,{
  spoken_script:original,creative_style:'premium',hook:'Que tu llegada diga más.'
 });
 assert.equal(fix.style,'premium');
 assert.ok(fix.readiness.tooShort);
 assert.ok(fix.slogan);
 assert.equal(premiumPolishNeed({...project,audio_mode:'no_voice'},{
  spoken_script:original,creative_style:'premium'
 }),null);
 assert.equal(premiumPolishNeed({...project,video_duration_seconds:8},{
  spoken_script:original,creative_style:'premium'
 }),null);
});
test('one polished narration preserves market-neutral buyer intent and fits the chosen video',()=>{
 const sample=validatePremiumPolish(longNarration,project,{spoken_script:original,creative_style:'premium'});
 assert.ok(sample.words>=sample.budget.minimum&&sample.words<=sample.budget.maximum);
 assert.match(sample.speech,/Producto de prueba/);
 assert.match(sample.speech,/Escríbenos/);
 assert.throws(()=>validatePremiumPolish(original,project,{spoken_script:original}),/premium_polish_invalid_script/);
});
test('30s Premium movie no longer throws on an 8k model despite rich angle and 6 shots',()=>{
 const concept={
  name:'A specific buyer moment',creative_style:'premium',
  hook:'¿Y si tu primer detalle fuera el aroma?',
  buyer_motive:'Atención a la presentación personal para entrar con seguridad y confianza sin inventar efectos del producto.',
  requested_sales_angle:'Una imagen personal y una primera impresión cuidadosa',
  sales_angle_code:'confidence',spoken_script:longNarration,
  video_prompt:'Two adults arrive at a social gathering. The first one prepares the actual product and moves closer with relaxed, realistic confidence. Both exchange a believable, natural glance. This film must express the researched first-impression motive without false causal claims.'.repeat(4),
  shots:Array(6).fill('An adult makes a thoughtful physical gesture in a coherent interior with controlled lighting and real product use.'),
  cta:'Escríbenos para pedir el tuyo.'
 };
 const result=buildCommercialDirectorPackage({
  concept,productName:'Producto de prueba',description:project.description,
  duration:30,market:'EC',style:'premium',videoLanguage:'es',
  audioMode:'voiceover',castMode:'with_people',
  modelId:'kling-4.0-reference-to-video',workflowId:'references',
  imageProvided:true,promptMaxLength:8000
 });
 assert.ok(result.prompt.length<=8000);
 assert.match(result.prompt,/REALIZO LUXURY FILM CONTRACT v2/);
 assert.match(result.prompt,/P0 \/ IMMUTABLE PRODUCT SKU/);
 assert.match(result.prompt,/MANDATORY NARRATION MODE/);
 assert.match(result.prompt,/P0 \/ UNIVERSAL BUYER-ANGLE VISUAL CONTRACT/);
 assert.match(result.prompt,/P0 \/ APPROVED CONCEPT STORYBOARD/);
 assert.match(result.prompt,/buyer motive|MOTIVE|BUYER ANGLE/i);
 assert.ok(result.prompt.includes(longNarration),'keep ALL approved speech without chopping');
 assert.equal(result.spoken_script,longNarration);
});
test('the movie voiceover never chops customer-approved speech at 650 characters',()=>{
 const script=Array.from({length:77},(_,i)=>i===76?'ULTIMAPALABRA':'palabra-número-'+i).join(' ');
 assert.ok(script.length>650);
 const audio=filmAudioDirection('voiceover','with_people','es',script,30);
 assert.match(audio,/ULTIMAPALABRA/);
 assert.match(audio,/30-second/);
 assert.match(audio,/no unexplained long mute intervals/);
});
test('internal AI speech repair is schema-validated, single-call and never uses wallet',async()=>{
 const old=globalThis.fetch;
 let calls=0;
 try{
  globalThis.fetch=async(url,request)=>{
   calls++;
   assert.equal(url,'https://api.openai.com/v1/responses');
   const body=JSON.parse(request.body);
   assert.equal(body.store,false);
   assert.equal(body.tools,undefined,'no repeat web research');
   assert.equal(body.text.format.name,'realizo_spoken_copy_quality_v1');
   return {ok:true,async json(){return {status:'completed',output:[{
    type:'message',content:[{type:'output_text',text:JSON.stringify({spoken_script:longNarration})}]
   }]}}};
  };
  const result=await polishPremiumSpeechWithAI({
   OPENAI_API_KEY:'test-only-do-not-send',OPENAI_PREMIUM_MODEL:'test-model'
  },project,{spoken_script:original,creative_style:'premium',hook:'Que tu llegada diga más.'});
  assert.equal(result,longNarration);
  assert.equal(calls,1);
 }finally{globalThis.fetch=old;}
});
test('speech polish is idempotent, owner-scoped and not charged to customer wallets',()=>{
 const route=readFileSync('app/api/realizo/ai-premium/[id]/polish/route.js','utf8');
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 const schema=readFileSync('migrations/0036_realizo_premium_speech_polish.sql','utf8');
 const approve=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(route,/requireWalletUser/);
 assert.match(route,/id=\? AND user_id=\?/);
 assert.match(route,/INSERT OR IGNORE INTO realizo_ai_premium_speech_polish/);
 assert.match(route,/ctx\.waitUntil\(task\)/);
 assert.match(schema,/PRIMARY KEY\(project_id,concept_index\)/);
 assert.doesNotMatch(route,/wallet_ledger|generation_jobs|payment_provider|createReservedJob|chargeWallet|captureWallet/);
 assert.match(ui,/\/polish/);
 assert.match(ui,/setSpeechEdits\(prev=>Object\.hasOwn\(prev,selection\)\?prev:/);
 assert.match(ui,/voiceBudget/);
 assert.match(approve,/premium_speech_timing_invalid/);
 assert.match(approve,/premium_direction_cannot_be_prepared/);
 assert.match(approve,/commercial_direction_prompt_too_long/);
});

test('Kling 4.0 approval fits a saturated Premium commercial without discarding the exact spoken hook or sales angle',()=>{
 // Adversarial but legal: long reference storyboard, product map and 84-word
 // narration. The 8k provider ceiling must compress editor prose, not deny
 // the project or remove the researched concept.
 const speech=Array.from({length:84},(_,i)=>i===0?'¿Quieres':i===83?'Escríbenos.':'palabraextensacomercial'+String(i).padStart(2,'0')).join(' ');
 assert.ok(speech.length>1900&&speech.length<3200);
 const scene='Two adult customers exchange a distinctive romantic glance and move closer while experiencing the real product naturally. Their actions must tell a progressing attraction story, not an isolated packshot. '.repeat(9);
 const concept={
  name:'Una conexión visible',creative_style:'premium',
  requested_sales_angle:'Seduction / sensuality with adults, tasteful and credible',
  sales_angle_code:'seduction',hook:'¿Quieres que tu presencia se recuerde?',
  buyer_motive:'An intimate, playful adult encounter that moves from preparation to reciprocal interest without guaranteeing results.',
  spoken_script:speech,cta:'Escríbenos.',
  video_prompt:scene,shots:Array.from({length:8},(_,i)=>'Scene '+i+': a distinct adult reaction and real physical product interaction; visible progression and continuity, not a duplicate shot. '.repeat(3)),
 };
 const geometry={products:Array.from({length:4},(_,i)=>({
  name:'Real Producto '+i,container_type:'a matte glass bottle with a faithfully printed label',
  body_shape:'tall precise cylinder, straight sides and authentic scale in adult hands',
  closure_type:'original matching cap and closure geometry',
  main_colors:'dark blue, subtle silver, deep graphite, and identical packaging artwork'
 }))};
 for(const modelId of ['kling-4.0-reference-to-video','kling-4.0-keyframe-to-video','kling-4.0-flash-reference-to-video']){
  const result=buildCommercialDirectorPackage({
   concept,productName:'Producto de prueba',description:project.description,
   duration:modelId.includes('flash')?20:30,market:'EC',style:'premium',videoLanguage:'es',
   audioMode:'voiceover',castMode:'with_people',modelId,
   workflowId:modelId.includes('keyframe')?'animate_image':'references',
   imageProvided:true,productGeometry:geometry,promptMaxLength:7900
  });
  assert.ok(result.prompt.length<=7900,modelId+' '+result.prompt.length);
  assert.ok(result.prompt.includes(speech),modelId+' must retain every spoken word');
  assert.match(result.prompt,/P0 \/ IMMUTABLE PRODUCT SKU/);
  assert.match(result.prompt,/P0 \/ UNIVERSAL BUYER-ANGLE VISUAL CONTRACT/);
  assert.match(result.prompt,/P0 \/ APPROVED CONCEPT STORYBOARD/);
  assert.match(result.prompt,/sensual|seduct|attraction/i);
  assert.match(result.prompt,/same|exact|packaging|original/i);
 }
});
test('Kling approval persists approved status only after the media and final model request are valid',()=>{
 const route=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const media=route.indexOf('const asset=await db.prepare(');
 const packet=route.indexOf('readyForGeneration=liveContract?');
 const approved=route.indexOf("UPDATE realizo_ai_projects SET status='approved'");
 assert.ok(media>0&&packet>media&&approved>packet,
  'failed media/model preparation must never leave the project prematurely approved');
 assert.match(route,/premium_direction_cannot_be_prepared/);
});

test('Kling 4.0 UGC 30s keeps full speech, researched angle and every second when 8k limit is tight',()=>{
 const cases=[
  {modelId:'kling-4.0-reference-to-video',workflowId:'references',seconds:30},
  {modelId:'kling-4.0-keyframe-to-video',workflowId:'animate_image',seconds:30},
  {modelId:'kling-4.0-flash-reference-to-video',workflowId:'references',seconds:20},
 ];
 for(const {modelId,workflowId,seconds} of cases){
  const count=seconds===30?86:56;
  const voice=Array.from({length:count},(_,i)=>i===0?'¿Te imaginas':i===count-1?'Escríbenos ahora.':'palabraextensacomercial'+String(i).padStart(2,'0')).join(' ');
  const concept={
   name:'Una conexión diferente',creative_style:'ugc',
   hook:'¿Te imaginas una primera impresión diferente?',
   buyer_motive:'Show a physically credible adult encounter with visible reciprocal interest, linked to the user's chosen sensual sales angle.',
   requested_sales_angle:'Sensual / seduction for adult customers, tasteful but visibly flirtatious',
   sales_angle_code:'seduction',spoken_script:voice,
   video_prompt:'An adult first approaches the camera, describes the specific purchasing desire, handles the original item naturally, and continues to speak while a second adult responds with a meaningful look. '.repeat(9),
   shots:Array.from({length:8},(_,i)=>'Distinct spoken beat '+i+' with an observable cause-and-effect action and authentic product handoff. '.repeat(3)),
   cta:'Escríbenos ahora.'
  };
  const geometry={products:Array.from({length:4},(_,i)=>({
   name:'Producto real '+i,container_type:'opaque painted cylinder with original printed label',
   body_shape:'rectangular or cylindrical as reference photo exactly documents',
   closure_type:'original factory cap/dropper as verified',
   main_colors:'genuine saturated tones, authentic readable label and no invented logo'
  }))};
  const director=buildCommercialDirectorPackage({
   concept,productName:'Producto real de prueba',
   description:'Artículo físico de presentación personal para un comprador adulto, sin resultados garantizados. '.repeat(5),
   market:'EC',videoLanguage:'es',duration:seconds,
   modelId,workflowId,style:'ugc',castMode:'with_people',audioMode:'no_voice',
   imageProvided:true,productGeometry:geometry,
   promptMaxLength:7900,
  });
  assert.ok(director.prompt.length<=7900,modelId+': '+director.prompt.length);
  assert.ok(director.prompt.includes(voice),'must preserve every word from the researched 30s dialogue');
  assert.match(director.prompt,/P0 \/ IMMUTABLE PRODUCT SKU/);
  assert.match(director.prompt,/P0 \/ UNIVERSAL BUYER-ANGLE VISUAL CONTRACT/);
  assert.match(director.prompt,/P0 \/ APPROVED CONCEPT STORYBOARD/);
  assert.match(director.prompt,/ONE-SECOND DIRECTOR TIMELINE/);
  assert.match(director.prompt,/speak|SPEAK/);
  assert.match(director.prompt,/sensual|seduct|attraction|flirt/i);
  assert.match(director.prompt,/IMAGE|REFERENCE|START FRAME/i);
  assert.match(director.prompt,/final second/i);
 }
});
