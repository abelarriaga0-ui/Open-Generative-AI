import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProductCopy,videoEngineCapabilities,planSalesVideo,
 buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {voiceBudget,salesBeatPlan,improveSalesScript,scriptReadiness,spokenHook,buyerIntent} from '../lib/realizo-creative/sales-storyboard.js';
import {safeResearchResponse,buildResearchRequest} from '../lib/realizo-creative/ai-premium.js';

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
 assert.match(ui,/Aprobar concepto y generar/);
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
 assert.match(result.prompt,/MODEL-AGNOSTIC SPOKEN UGC AUDIO PERFORMANCE/);
 assert.match(result.prompt,/90–98% of the chosen runtime/);
 assert.match(result.prompt,/SOLUTION is intelligible before the PRODUCT name/);
 assert.match(result.prompt,/speech must occupy nearly the whole video/i);
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
  assert.ok(x.prompt.length<=12500,'Prompt valid for '+modelId);
  assert.match(x.prompt,/MODEL-AGNOSTIC SPOKEN UGC AUDIO PERFORMANCE/);
  assert.match(x.prompt,/120-second runtime/);
  assert.match(x.prompt,/SPOKEN SCRIPT/);
  assert.match(x.prompt,/CTA: Pide información hoy/);
  assert.match(x.prompt,/SPEECH DENSITY \/ RUNTIME CHECK/);
 }
 const approved=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const editor=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(approved,/MAX_SPOKEN_SCRIPT_CHARACTERS/);
 assert.match(approved,/improveSalesScript\(originalSpeech/);
 const research=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 assert.match(research,/salesBeatPlan\(seconds,chosen\)/);
 assert.match(research,/REDACCIÓN UGC\/DEMO COMPATIBLE CON CUALQUIER MOTOR/);
 assert.doesNotMatch(research,/En 12 s NO entregues/);
});

test('demo/problem-solution receives the same timing and voice rules with any video engine',()=>{
 for(const duration of [8,12,20,30,60]){
  const beats=salesBeatPlan(duration,'demo');
  assert.equal(beats.length,6);
  assert.match(beats[1].name,/PROBLEMA/);
  assert.match(beats[2].name,/SOLUCIÓN/);
  assert.match(beats.at(-1).name,/CTA/);
  const spoken='¿Te falta una solución práctica? Este producto permite organizar tu rutina. Aprende cómo utilizarlo correctamente y consulta los detalles antes de comprarlo. Pide información hoy.';
  const plan=buildCommercialDirectorPackage({
   concept:{name:'Demostración',angle:'problem',hook:'¿Te falta una solución?',spoken_script:spoken,cta:'Pide información hoy'},
   productName:'Producto real',description:'Producto de uso habitual',style:'demo',
   duration,modelId:'kling-example-image-to-video'
  });
  assert.equal(plan.sales_beats.length,6);
  assert.match(plan.prompt,/MODEL-AGNOSTIC DEMO \/ PROBLEM-SOLUTION AUDIO/);
  assert.match(plan.prompt,/SPOKEN SCRIPT/);
  assert.match(plan.prompt,/CTA: Pide información hoy/);
 }
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(approval,/spokenStyle=selectedStyle\(finalStyle,concept\.creative_style\)/);
 assert.match(approval,/scriptReadiness\(userSpeech,\{seconds:duration,style:spokenStyle,description:project.description/);
});

test('paid NOIL research image-description is repaired into a buyer-pain UGC script without an AI re-charge',()=>{
 const description='NOIL shampoo perfumado para tener un olor irresistible a las mujeres y causar buena primera impresión';
 const bad='¿Buscas una solución para tu día a día? Conoce NOIL: La fotografía muestra un envase con la marca NOIL y la categoría HAIR CARE SHAMPOO. Una alternativa para tu rutina. Conoce NOIL en esta publicación.';
 const source={name:'Antes de salir',angle:'benefits',creative_style:'ugc',
  spoken_script:bad,hook:'¿Listo para salir? Empieza por tu rutina.',
  cta:'Conoce NOIL en esta publicación',buyer_motive:'Elegir un producto de cuidado capilar'};
 const old={
  id:'saved-premium',product_name:'NOIL',description,creative_style:'ugc',video_language:'es',
  video_duration_seconds:12,video_model_id:'seedance-2.5-intl-omni-reference',
  market_code:'EC',status:'ready',
  findings_json:JSON.stringify({selected_sales_angle:'Una rutina de lavado con un toque perfumado',
   product_dossier:{actual_category:'HAIR CARE SHAMPOO',features:['La fotografía muestra un envase con la marca']}}),
  concepts_json:JSON.stringify([source,source,source]),
 };
 const restored=safeResearchResponse(old),result=restored.concepts[0];
 const ready=scriptReadiness(result.spoken_script,{seconds:12,style:'ugc',description});
 assert.equal(ready.tooShort,false);
 assert.equal(ready.tooLong,false);
 assert.deepEqual(ready.qualityIssues,[]);
 assert.equal(ready.weakStructure,false);
 assert.match(result.spoken_script,/impresionarla|impresi[oó]n/i);
 assert.match(result.spoken_script,/olvidas|aroma|hueles/i);
 assert.match(result.spoken_script,/soluci[oó]n/i);
 assert.match(result.spoken_script,/NOIL.+shampoo perfumado/i);
 assert.match(result.spoken_script,/Pide NOIL hoy\.$/);
 assert.doesNotMatch(result.spoken_script,/fotograf[ií]a|fotograf[ií]a muestra|envase|esta publicaci[oó]n|hair care shampoo/i);
 assert.equal(result.hook,spokenHook(result.spoken_script));
 assert.equal(result.cta,'Pide NOIL hoy');
 assert.match(result.buyer_motive,/primera impresi[oó]n/i);
 assert.match(restored.findings.selected_sales_angle,/primera impresi[oó]n/i);
 const video=buildCommercialDirectorPackage({
  concept:result,productName:'NOIL',description,style:'ugc',duration:12,
  modelId:'seedance-2.5-intl-omni-reference'
 });
 assert.match(video.prompt,/VOICE\/VISUAL BUYER-PAIN LOCK/);
 assert.match(video.prompt,/getting ready before going out/);
 assert.ok(video.prompt.includes(result.spoken_script),'The model receives the exact approved dialogue');
 assert.match(video.prompt,/CTA: Pide NOIL hoy/);
});

test('commercial desire scripting scales without promises for shampoos, perfumes and essences',()=>{
 const bad='¿Buscas una solución para tu día a día? La fotografía muestra un envase de la marca. Conoce el producto en esta publicación.';
 const products=[
  ['NOIL','Shampoo perfumado para tener un olor irresistible a las mujeres','HAIR CARE SHAMPOO'],
  ['GODA','Esencia de perfume para hombres que desean impresionar a las mujeres con un buen olor','esencia de perfume'],
 ];
 for(const [productName,description,actual_category] of products){
  for(const seconds of [5,8,12,15,20,25,30]){
   const speech=improveSalesScript(bad,{seconds,style:'ugc',productName,description,
    concept:{cta:'Conoce el producto en esta publicación',hook:'¿Listo para salir?'},
    report:{product_dossier:{actual_category}},language:'es'});
   const ready=scriptReadiness(speech,{seconds,style:'ugc',description});
   assert.equal(ready.tooShort,false,productName+' '+seconds+'s must fill the runtime');
   assert.equal(ready.tooLong,false,productName+' '+seconds+'s must fit runtime');
   assert.deepEqual(ready.qualityIssues,[],productName+' '+seconds+'s is buyer-relevant');
   assert.match(speech,new RegExp(productName));
   assert.doesNotMatch(speech,/fotograf[ií]a|garantiz|vas a conquistar|todas las mujeres se enamorar[aá]n/i);
  }
 }
});

test('research prompt makes seller buyer desire and audio-visual action the priority, not image inspection',()=>{
 const request=buildResearchRequest(
  {OPENAI_PREMIUM_MODEL:'gpt-6-luna',REALIZO_ENV:'production'},
  {id:'demo',signedImage:'data:image/jpeg;base64,YWJj',product_name:'NOIL',
   description:'Shampoo perfumado con aroma para impresionar en una cita',
   video_duration_seconds:12,creative_style:'ugc',video_language:'es',market_code:'EC',
   video_model_id:'seedance-2.5-intl-omni-reference'}
 );
 assert.match(request.instructions,/DIRECTOR DE CONVERSI[ÓO]N/);
 assert.match(request.instructions,/DESCRIPCI[ÓO]N Y OBJETIVO COMERCIAL/);
 assert.match(request.instructions,/SINCRONIZACI[ÓO]N VIDEO Y VOZ/);
 assert.match(request.instructions,/PRIMER FOTOGRAMA/);
 assert.match(request.instructions,/ni garantizar atracción causada por un producto/);
 assert.equal(request.reasoning.effort,'high');
});

test('payment approval blocks photo narration and generic hooks before paid generation',()=>{
 const description='Shampoo perfumado para impresionar a las mujeres con su aroma';
 const unacceptable='¿Buscas una solución para tu día a día? Conoce NOIL. La fotografía muestra un envase. Pide NOIL hoy.';
 const r=scriptReadiness(unacceptable,{seconds:12,style:'ugc',description});
 assert.ok(r.qualityIssues.includes('image_narration'));
 assert.ok(r.qualityIssues.includes('generic_hook'));
 assert.ok(r.qualityIssues.includes('seller_desire_missing'));
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(approval,/ugc_speech_quality_invalid/);
 assert.match(approval,/timing\.qualityIssues\.length/);
 const client=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(client,/ugc_speech_quality_invalid/);
});

test('seller typos in attraction language retain the true aroma selling angle',()=>{
 const seller='NOIL shampoo para tener un olor irreciscitble a lals muejres y recibir alagos';
 assert.equal(buyerIntent(seller).socialScent,true);
 const old='¿Buscas una solución para tu día a día? La fotografía muestra la marca NOIL. Conoce NOIL en esta publicación.';
 const copy=improveSalesScript(old,{
  seconds:12,style:'ugc',productName:'NOIL',description:seller,
  concept:{hook:'¿Listo para salir?',cta:'Conoce NOIL en esta publicación'},
  report:{product_dossier:{actual_category:'HAIR CARE SHAMPOO'}},language:'es'
 });
 const quality=scriptReadiness(copy,{seconds:12,style:'ugc',description:seller});
 assert.equal(quality.tooShort,false);
 assert.equal(quality.tooLong,false);
 assert.deepEqual(quality.qualityIssues,[]);
 assert.match(copy,/aroma|hueles/i);
 assert.doesNotMatch(copy,/fotograf[ií]a|publicaci[oó]n/i);
});

test('Candela 10-second UGC is rewritten from the merchant skin concern, not the photographed label',()=>{
 const description='Candela crema corporal para el cuidado de la apariencia de las estrías, se utiliza mediante masajes';
 const bad='¿Tu rutina se olvida Candela para la foto identifica la marca visible como candela y muestra las menciones estrías. Así puedes completar tu rutina de forma sencilla. Escríbenos para pedir información.';
 const badQuality=scriptReadiness(bad,{seconds:10,style:'ugc',description});
 assert.ok(badQuality.qualityIssues.includes('image_narration'));
 assert.equal(badQuality.tooLong,false,'The bad script fits the time but MUST still fail content review');
 const concept={
  name:'Un masaje sin complicarlo',creative_style:'ugc',
  hook:'¿Tu rutina se olvida Candela para la foto identifica la marca visible?',
  spoken_script:bad,cta:'Escríbenos para pedir información',
  buyer_motive:'Incluir una crema corporal en un momento cotidiano de masaje',
  shots:['La foto identifica la marca y envase'],
  video_prompt:'Una toma estática del envase y su texto'
 };
 const project={
  id:'candela-old',product_name:'Candela',description,video_language:'es',
  video_duration_seconds:10,video_model_id:'seedance-2.5-intl-omni-reference',
  creative_style:'ugc',market_code:'EC',status:'ready',
  findings_json:JSON.stringify({selected_sales_angle:'Cuidado de las estrías mediante una rutina de masaje',
   product_dossier:{actual_category:'Crema corporal',
    features:['La foto identifica la marca visible y menciones estrías']}}),
  concepts_json:JSON.stringify([concept,concept,concept])
 };
 const recovered=safeResearchResponse(project),chosen=recovered.concepts[1];
 const quality=scriptReadiness(chosen.spoken_script,{seconds:10,style:'ugc',description});
 assert.equal(quality.tooShort,false);
 assert.equal(quality.tooLong,false);
 assert.deepEqual(quality.qualityIssues,[]);
 assert.match(chosen.spoken_script,/¿(?:Las estrías te incomodan|Te incomoda mostrar tus estrías)\?/i);
 assert.match(chosen.spoken_script,/masaje/i);
 assert.match(chosen.spoken_script,/Candela, crema corporal/i);
 assert.match(chosen.spoken_script,/Escríbenos para pedir información\.$/);
 assert.doesNotMatch(chosen.spoken_script,/la foto|marca visible|envase|menciones|fotograf[ií]a|promete eliminar/i);
 assert.equal(chosen.hook,spokenHook(chosen.spoken_script));
 assert.equal(chosen.shots.length,2);
 assert.match(chosen.shots[0],/estrías en su piel/i);
 assert.match(chosen.shots[1],/aplicación corporal/i);
 assert.doesNotMatch(chosen.video_prompt,/foto identifica|envase y su texto|toma estática/i);
 const director=buildCommercialDirectorPackage({
  concept:chosen,productName:'Candela',description,duration:10,
  style:'ugc',modelId:'seedance-2.5-intl-omni-reference'
 });
 assert.match(director.prompt,/VOICE\/VISUAL STRIAE BUYER-PAIN LOCK/);
 assert.match(director.prompt,/SPOKEN SCRIPT/);
 assert.ok(director.prompt.includes(chosen.spoken_script));
 assert.match(director.prompt,/CTA: Escríbenos para pedir información/);
});

test('all short Candela runtimes avoid photo metadata and false stretch-mark claims',()=>{
 const description='Crema corporal Candela para el cuidado de la apariencia de las estrías mediante masaje';
 const bad='¿Tu rutina se olvida Candela para la foto identifica la marca visible como Candela y muestra las menciones estrías. Así puedes completar tu rutina de forma sencilla. Escríbenos para pedir información.';
 for(const seconds of [5,8,10,12,15,20,30]){
  for(const style of ['ugc','demo']){
   const spoken=improveSalesScript(bad,{seconds,style,productName:'Candela',
    description,concept:{cta:'Escríbenos para pedir información',
     buyer_motive:'Cuidado corporal mediante una rutina de masaje'},
    report:{product_dossier:{actual_category:'Crema corporal',
     features:['La foto identifica la marca visible como Candela']}},
    language:'es'});
   const quality=scriptReadiness(spoken,{seconds,style,description});
   assert.equal(quality.tooShort,false,style+' '+seconds+' too short');
   assert.equal(quality.tooLong,false,style+' '+seconds+' too long');
   assert.deepEqual(quality.qualityIssues,[],style+' '+seconds+' spoken quality');
   assert.match(spoken,/estrías/i);
   assert.match(spoken,/Candela/);
   assert.doesNotMatch(spoken,/la foto|fotograf[ií]a|marca visible|envase|borrará|elimina las estrías/i);
  }
 }
});

test('one paid research request explicitly excludes photographed label metadata from speech',()=>{
 const request=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},{
  product_name:'Candela',description:'Crema corporal para masaje de la piel con estrías',
  video_duration_seconds:10,creative_style:'ugc',video_language:'es',
  video_model_id:'seedance-2.5-intl-omni-reference',market_code:'EC'
 });
 assert.match(request.instructions,/CONTROL ANTI-NARRACIÓN/);
 assert.match(request.instructions,/marca visible/);
 assert.match(request.instructions,/GENERALIZACIÓN COMERCIAL/);
 assert.match(request.instructions,/REVISIÓN DE COPY ANTES DEL JSON/);
 const aiSource=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 assert.match(aiSource,/quality\.billable=false;quality\.needsReview=true/);
});

test('Premium review is concept-only and preserves all choices stored before research',()=>{
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const review=ui.split('    {ready&&<>')[1]?.split('    </>}')[0]||'';
 assert.ok(review.includes('concepts.map('),'three researched concepts are shown');
 assert.match(review,/Aprobar concepto y generar/);
 assert.doesNotMatch(review,/<select|type="checkbox"/);
 assert.match(review,/Editar guion de este concepto/);
 assert.doesNotMatch(review,/¿Quién aparece|¿Qué sonido|¿Cómo quieres que se vea|Duración final/);
 assert.match(ui,/body:JSON.stringify\(\{index:selection/);
 assert.doesNotMatch(approval,/body\.(?:video_model_id|video_duration_seconds|cast_mode|audio_mode|style|prompt)/);
 assert.match(approval,/normalizeCastMode\(project\.cast_mode\)/);
 assert.match(approval,/normalizeAudioMode\(project\.audio_mode\)/);
 assert.match(approval,/resolveAnyPremiumVideoChoice\(modelId,project\.video_duration_seconds\)/);
 assert.match(approval,/const finalStyle=selectedTemplate\?\.style\|\|selectedStyle\(initialStyle,concept\.creative_style\)/);
 assert.match(approval,/improveSalesScript\(originalSpeech/);
 assert.match(approval,/const finalPrompt=director\.prompt\+referenceTag;/);
});
