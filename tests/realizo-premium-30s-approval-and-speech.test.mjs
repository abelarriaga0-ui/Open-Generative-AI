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
 assert.doesNotMatch(route,/wallet_ledger|generation_jobs|payment_provider|charge|capture/);
 assert.match(ui,/\/polish/);
 assert.match(ui,/setSpeechEdits\(prev=>Object\.hasOwn\(prev,selection\)\?prev:/);
 assert.match(ui,/voiceBudget/);
 assert.match(approve,/premium_speech_timing_invalid/);
 assert.match(approve,/premium_direction_cannot_be_prepared/);
 assert.match(approve,/commercial_direction_prompt_too_long/);
});
