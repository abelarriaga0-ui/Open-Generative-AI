import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {voiceBudget,salesBeatPlan,SALES_STRUCTURES,scriptReadiness,improveSalesScript,speechWords} from '../lib/realizo-creative/sales-storyboard.js';
import {buildResearchRequest,safeResearchResponse} from '../lib/realizo-creative/ai-premium.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';

const concept={
 name:'Dos pasos, un combo',creative_style:'ugc',
 hook:'¿Te alistas en dos pasos?',buyer_motive:'Cuidado y aroma en una sola rutina',
 spoken_script:'¿Te alistas en dos pasos? NOIL es shampoo y GODA, perfume en gotero de 15 ml. Mira el combo y escríbenos para consultar y comprar.',
 cta:'Escríbenos por el combo',video_prompt:'Hombre mostrando dos productos',
};
const report={product_dossier:{
 identified_product:'Combo NOIL + GODA',actual_category:'cuidado capilar y perfume',
 features:['NOIL shampoo','GODA esencia masculina'],realistic_uses:[],
},verified_claims:['NOIL es shampoo','GODA es perfume']};
test('12s UGC script gets pain / combo solution / benefit / CTA without second LLM',()=>{
 const fixed=improveSalesScript(concept.spoken_script,{seconds:12,style:'ugc',
  productName:'Combo NOIL + GODA',concept,report});
 assert.match(fixed,/¿Te falta algo|¿Te alistas/i);
 assert.match(fixed,/NOIL/);
 assert.match(fixed,/GODA/);
 assert.match(fixed,/cabello/);
 assert.match(fixed,/aroma/);
 assert.match(fixed,/rutina/);
 assert.match(fixed,/Escríbenos/);
 assert.doesNotMatch(fixed,/feromonas|garantizado|cura|resultados en/i);
 const budget=voiceBudget(12,'ugc');
 assert.ok(speechWords(fixed)>=budget.minimum&&speechWords(fixed)<=budget.maximum);
 assert.equal(scriptReadiness(fixed,{seconds:12,style:'ugc'}).weakStructure,false);
});
test('all formats use structured sales progression and a duration-dependent voice budget',()=>{
 for(const style of ['ugc','cinematic','premium','demo']){
  const beats=salesBeatPlan(12,style);
  assert.equal(beats.length,5);
  assert.equal(beats[0].start,0);
  assert.equal(beats[4].end,12);
  assert.match(beats[0].name,/HOOK/);
  assert.match(beats[4].name,/CTA/);
  assert.match(SALES_STRUCTURES[style],/producto/i);
  const prompt=buildCommercialDirectorPackage({
   concept:{...concept,creative_style:style,spoken_script:'¿Te falta algo al salir? NOIL para cabello y GODA para aroma. Dos pasos para tu rutina. Escríbenos.'},
   productName:'Combo NOIL + GODA',description:'Shampoo NOIL y perfume GODA',
   duration:12,style,modelId:'seedance-2.5-intl-omni-reference',
  });
  assert.equal(prompt.sales_beats.length,5);
  assert.match(prompt.prompt,/NMF SALES STORY/);
  assert.match(prompt.prompt,/SECOND-BY-SECOND SELLING PLAN/);
  assert.match(prompt.prompt,/TOP-PRIORITY AUDIO DIRECTOR/);
  assert.ok(prompt.prompt.length<=5400);
 }
 assert.ok(voiceBudget(30,'ugc').target>voiceBudget(12,'ugc').target);
});
test('older researched project receives improved script without new provider calls or billing',()=>{
 const project={id:'p',product_name:'Combo NOIL + GODA',
  creative_style:'ugc',video_duration_seconds:12,video_language:'es',market_code:'EC',
  concepts_json:JSON.stringify([concept,concept,concept]),
  findings_json:JSON.stringify(report)};
 const result=safeResearchResponse(project);
 assert.equal(result.concepts.length,3);
 assert.match(result.concepts[0].spoken_script,/cabello/);
 assert.equal(result.concepts[0].video_prompt,concept.video_prompt);
});
test('new paid research writes a complete 5-beat ad script, no request for another research call',()=>{
 const project={id:'123',signedImage:'https://example.test/product.png',
  product_name:'Combo NOIL + GODA',description:'Shampoo y fragancia',
  video_duration_seconds:12,creative_style:'ugc',video_model_id:'seedance-2.5-intl-omni-reference',
  market_code:'EC',video_language:'es',sales_angle:'auto'};
 const req=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna',REALIZO_ENV:'sandbox'},project);
 assert.match(req.instructions,/no.*«nombre del producto/i);
 assert.match(req.instructions,/problema, incomodidad o deseo/i);
 assert.match(req.instructions,/REDACCIÓN POR SEGUNDOS/);
 assert.match(req.instructions,/ESTRUCTURA PROPIA POR FORMATO/);
 assert.equal(req.input[0].content.filter(x=>x.type==='input_image').length,1);
 assert.equal(req.max_tool_calls,5);
 assert.equal(req.tool_choice,'required');
 const route=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(route,/spoken_script:userSpeech/);
});
