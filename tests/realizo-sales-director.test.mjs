import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProductCopy,videoEngineCapabilities,planSalesVideo,
 buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {voiceBudget,salesBeatPlan,improveSalesScript,scriptReadiness} from '../lib/realizo-creative/sales-storyboard.js';

const concept={name:'Nippori UGC',angle:'ugc',hook:'¿La caspa te incomoda?',
 spoken_script:'¿Caspa otra vez? Mira Nippori. Descubre el producto y pide hoy. Paga al recibir.',
 cta:'Paga al recibir',shots:['Hook selfie','Uso real','CTA'],
 video_prompt:'Adult speaks to camera with product in bathroom'};
test('seller typos are normalized without inventing claims or asking a rewrite',()=>{
 assert.match(normalizeProductCopy('Shamppo para dermatitis ceboreica'),/Shampoo para dermatitis seborreica/i);
});
test('Seedance 2.5 references are distinct from first-frame animation',()=>{
 assert.equal(videoEngineCapabilities('seedance-2.5-omni-reference').imageRole,'product_reference');
 assert.equal(videoEngineCapabilities('seedance-2.5-image-to-video').imageRole,'start_frame');
 assert.equal(videoEngineCapabilities('seedance-2.5-text-to-video').imageRole,'none');
 const plan=buildCommercialDirectorPackage({concept,productName:'Nippori',
 description:'Shamppo para dermatitis ceboreica',cta:'Paga al recibir',
 modelId:'seedance-2.5-omni-reference',duration:7,style:'ugc',shotPreference:'multi'});
 assert.match(plan.prompt,/NOT the first frame/);
 assert.match(plan.prompt,/SPOKEN SCRIPT/);
 assert.match(plan.prompt,/CTA/);
 assert.match(plan.prompt,/UGC TALKING-HEAD SCHEDULE/);
 assert.match(plan.prompt,/UGC SALES REVIEW/);
 assert.match(plan.prompt,/VOICE-FIRST EDITING/);
 assert.match(plan.prompt,/voice NEVER stops/i);
 // Research visuals may be edited for other formats, but must not override
 // dialogue continuity for UGC.
 assert.doesNotMatch(plan.prompt,/RESEARCHED SHOT IDEAS/);
 assert.equal(plan.shot_count,2);
 assert.equal(plan.media_role,'reference_only');
 assert.equal(plan.warning,null);
 const i2v=buildCommercialDirectorPackage({concept,modelId:'seedance-2.5-image-to-video'});
 assert.match(i2v.warning,/primer fotograma/);
});
test('cinematic mode and multi-shot selection are constrained by time not invented pricing',()=>{
 const short=planSalesVideo({concept,style:'cinematic',shotPreference:'multi',duration:5});
 const long=planSalesVideo({concept,style:'cinematic',shotPreference:'multi',duration:15});
 assert.equal(short.shots,2);
 assert.equal(long.shots,5);
 assert.equal(long.cinema,true);
 assert.equal(short.voice,concept.spoken_script);
 assert.equal(short.voiceTooLong,true);
 const c=buildCommercialDirectorPackage({concept,style:'cinematic',shotPreference:'multi',
 modelId:'seedance-2.5-omni-reference',duration:15});
 assert.match(c.prompt,/CINEMATOGRAPHIC/);
 assert.match(c.prompt,/5 motivated shots/);
 assert.match(c.prompt,/LUXURY BRAND FILM TIMELINE/);
 assert.doesNotMatch(c.prompt,/NMF SALES STORY|UGC TALKING-HEAD SCHEDULE/);
 assert.doesNotMatch(c.prompt,/\b(?:free generation|automatically retry)\b/i);
});
test('Premium approved brief actually selects provider reference workflow and charges only after quote',()=>{
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(editor,/preparedBrief\.media_role\s*===\s*'reference_only'/);
 assert.match(editor,/getVideoWorkflowFamily\(item\.id\)\?\.workflowById\.get\("references"\)/);
 assert.match(editor,/referenceImages:images/);
 assert.match(editor,/allowAnimationInsteadOfReference/);
 assert.match(editor,/dynamicDirection/);
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(approval,/media_role:director.model_capabilities.imageRole/);
 assert.match(approval,/buildCommercialDirectorPackage/);
 assert.doesNotMatch(approval,/acknowledged_responsibility/);
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/Varias tomas/);
 assert.match(ui,/Cinematográfico/);
 assert.doesNotMatch(ui,/setCorrection/);
 const bridge=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(bridge,/\/api\/wallet\/quote/);
 assert.match(bridge,/confirmRealizoChargeInline/);
 assert.doesNotMatch(bridge,/window\.confirm/);
});

test('12-second UGC prioritizes a spoken buyer review over a five-shot silent montage',()=>{
 const source={name:'Combo NOIL + GODA',angle:'beneficio directo',
  hook:'¿Listo para salir?',spoken_script:'¿Te falta el toque final? NOIL para tu rutina capilar y GODA como esencia perfumada. Elige tu combo y pídelo hoy.',
  cta:'Pide el combo hoy',
  shots:['0–3 s hombre en espejo','3–6 s shampoo','6–9 s perfume','9–12 s mostrando envases'],
  video_prompt:'Mostrar 4 acciones separadas y 5 planos comerciales silenciosos'};
 const result=buildCommercialDirectorPackage({
   concept:source,productName:'Combo NOIL + GODA',
   description:'Shampoo perfumado NOIL más esencia concentrada de perfume GODA',
   style:'ugc',shotPreference:'multi',duration:12,modelId:'seedance-2.5-intl-omni-reference'
 });
 assert.equal(result.shot_count,2);
 assert.match(result.prompt,/0-1\.8s speaker says a concise compelling hook/i);
 assert.match(result.prompt,/70-85%/);
 assert.match(result.prompt,/SPOKEN SCRIPT \(Spanish, target market EC\)/);
 assert.match(result.prompt,/no standalone product montage/i);
 assert.doesNotMatch(result.prompt,/Mostrar 4 acciones separadas/);
 assert.doesNotMatch(result.prompt,/0–3 s hombre en espejo/);
 assert.match(result.prompt,/CTA/);
});

test('12-second spoken UGC has enough words, a full solution, and an end-of-video CTA',()=>{
 const budget=voiceBudget(12,'ugc');
 assert.deepEqual(budget,{minimum:30,target:34,maximum:37});
 const phases=salesBeatPlan(12,'ugc');
 assert.equal(phases.length,6);
 assert.equal(phases[0].end,1.8);
 assert.match(phases[1].name,/PROBLEMA/);
 assert.match(phases[2].name,/SOLUCIÓN/);
 assert.match(phases[3].name,/PRODUCTO/);
 assert.match(phases.at(-1).name,/CTA/);
 assert.equal(phases.at(-1).end,12);
 const improved=improveSalesScript('¿Sales hoy? Conoce NOIL y GODA. Escríbenos.',{
  seconds:12,style:'ugc',productName:'Combo NOIL + GODA',
  description:'Shampoo perfumado NOIL más esencia concentrada de perfume GODA',
  concept:{hook:'¿Listo para salir?',cta:'Pide el combo hoy'},
  language:'es',
 });
 const ready=scriptReadiness(improved,{seconds:12,style:'ugc'});
 assert.equal(ready.tooShort,false);
 assert.equal(ready.tooLong,false);
 assert.match(improved,/La solución/);
 assert.match(improved,/NOIL/);
 assert.match(improved,/GODA/);
 assert.match(improved,/Pide el combo hoy/);
 const result=buildCommercialDirectorPackage({
  concept:{name:'Combo',angle:'problem',hook:'¿Listo para salir?',spoken_script:improved,cta:'Pide el combo hoy'},
  productName:'Combo NOIL + GODA',description:'Shampoo perfumado y esencia concentrada',
  style:'ugc',duration:12,modelId:'seedance-2.5-intl-omni-reference'
 });
 assert.match(result.prompt,/TOP-PRIORITY UGC AUDIO PERFORMANCE/);
 assert.match(result.prompt,/90–98% voice occupancy/);
 assert.match(result.prompt,/SOLUTION is intelligible before the PRODUCT name/);
 assert.match(result.prompt,/speech occupies nearly the entire runtime/i);
 assert.match(result.prompt,/final spoken CTA|final 0.2 seconds/);
});

test('approval blocks sparse UGC audio before confirming video generation',()=>{
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(approval,/scriptReadiness\(userSpeech/);
 assert.match(approval,/ugc_speech_timing_invalid/);
 assert.ok(scriptReadiness('Mira esto. Compra hoy.',{seconds:12,style:'ugc'}).tooShort);
 assert.equal(voiceBudget(30,'ugc').target,84);
 const master=readFileSync('lib/realizo-creative/ugc-master-30.js','utf8');
 assert.match(master,/voiceBudget\(30,'ugc'\)/);
 assert.match(master,/90-98% of runtime/);
});

test('spoken sales timing scales across every supported runtime, not a fixed 12-second preset',()=>{
 const runtimes=[5,8,10,12,15,20,30,45,60,90,120];
 let priorWords=0;
 for(const seconds of runtimes){
  const b=voiceBudget(seconds,'ugc');
  const demo=voiceBudget(seconds,'demo');
  const phases=salesBeatPlan(seconds,'ugc');
  assert.ok(b.minimum<=b.target&&b.target<=b.maximum);
  assert.ok(demo.minimum<=demo.target&&demo.target<=demo.maximum);
  assert.ok(b.target>priorWords);
  priorWords=b.target;
  assert.equal(phases.length,6);
  assert.equal(phases[0].start,0);
  assert.equal(phases.at(-1).end,seconds);
  assert.ok(phases.every((p,i)=>p.end>p.start&&(i===0||p.start>=phases[i-1].end)));
  assert.match(phases[1].name,/PROBLEMA/);
  assert.match(phases[2].name,/SOLUCIÓN/);
  assert.match(phases[3].name,/PRODUCTO/);
  assert.match(phases[5].name,/CTA/);
 }
 for(const seconds of [5,8,10,12,15,20,25,30]){
  const dialogue=improveSalesScript('Conoce NOIL y GODA. Pide el combo.',{
   seconds,style:'ugc',productName:'Combo NOIL + GODA',
   description:'Shampoo perfumado NOIL más esencia concentrada de perfume GODA',
   concept:{hook:'¿Listo para salir?',cta:'Pide el combo hoy'},language:'es'
  });
  const result=scriptReadiness(dialogue,{seconds,style:'ugc'});
  assert.equal(result.tooShort,false,'No sparse script at '+seconds+' seconds');
  assert.equal(result.tooLong,false,'No overlong script at '+seconds+' seconds');
  assert.equal(result.weakStructure,false,'Complete commercial story at '+seconds+' seconds');
  assert.match(dialogue,/NOIL/);
  assert.match(dialogue,/GODA/);
  assert.match(dialogue,/Pide el combo hoy/);
 }
});

test('identical spoken sales directions apply across model families and preserve long scripts',()=>{
 const script=Array.from({length:26},()=>'Resuelve tu rutina con el producto y descubre el beneficio en su uso.').join(' ')
  +' Pide información hoy.';
 assert.ok(script.length>1000&&script.length<3200);
 for(const modelId of [
  'seedance-2.5-intl-omni-reference','kling-any-image-to-video','veo-3.1-reference-to-video',
  'minimax-text-to-video','wan-i2v','provider-new-model'
 ]){
  const x=buildCommercialDirectorPackage({
   concept:{name:'UGC',angle:'problem',hook:'¿Te falta algo?',spoken_script:script,
    cta:'Pide información hoy'},productName:'NOIL',description:'Shampoo perfumado',
   style:'ugc',duration:120,modelId
  });
  assert.equal(x.spoken_script,script,'Script preserved for '+modelId);
  assert.ok(x.prompt.length<=5400,'Prompt valid for '+modelId);
  assert.match(x.prompt,/MODEL-AGNOSTIC SPOKEN UGC AUDIO PERFORMANCE/);
  assert.match(x.prompt,/120-second runtime/);
  assert.match(x.prompt,/SPOKEN SCRIPT/);
  assert.match(x.prompt,/CTA: Pide información hoy/);
  assert.match(x.prompt,/SPEECH DENSITY \/ RUNTIME CHECK/);
 }
 const approved=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const editor=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(approved,/MAX_SPOKEN_SCRIPT_CHARACTERS/);
 assert.match(editor,/maxLength=\{MAX_SPOKEN_SCRIPT_CHARACTERS\}/);
 const research=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 assert.match(research,/salesBeatPlan\(seconds,chosen\)/);
 assert.match(research,/REDACCIÓN UGC\/DEMO COMPATIBLE CON CUALQUIER MOTOR/);
 assert.doesNotMatch(research,/En 12 s NO entregues/);
});
