import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {researchSchema,buildResearchRequest,parseResearchResult} from '../lib/realizo-creative/ai-premium.js';
import {FORMAT_GUIDES} from '../lib/realizo-creative/format-guides.js';
import {planSalesVideo,buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {estimateOpenAIResearchCost} from '../lib/realizo-creative/openai-costs.js';

const url='https://manufacturer.example/noil-shampoo';
const script='¿Buscas completar tu rutina? NOIL es shampoo perfumado y GODA es una esencia para hombre. Dos productos para dos pasos de tu preparación. Conoce el combo y pídelo hoy.';
function report(style='ugc'){
 const concepts=[0,1,2].map((n)=>({
  name:'Concepto '+(n+1),creative_style:style,angle:['rutina','combinación','ocasión'][n],
  buyer_motive:['Higiene diaria','Rutina combinada','Preparación para salir'][n],
  reason:'Beneficio y necesidad basados en ficha verificable',
  key_evidence_claims:['Shampoo perfumado NOIL','GODA esencia masculina'],
  hook:['¿Tu rutina está incompleta?','¿Qué te falta al salir?','¿Solo usas perfume?'][n],
  script:'Guion del vendedor',spoken_script:script,
  video_prompt:'Actor en escena real explicando características del shampoo y perfume; movimiento natural y uso verificable, sin inventar resultados.',
  cta:'Consulta el combo',shots:['A cámara, engancha y explica','Breve uso del producto con voz continua'],restrictions:['No falsas promesas'],
 }));
 return {product_observation:'Foto de dos envases NOIL y GODA',
  product_dossier:{identified_product:'Combo NOIL + GODA',identity_status:'partial',
   actual_category:'cuidado personal y perfume',manufacturer_or_brand:'NOIL y GODA',
   components_or_ingredients:[],features:['Shampoo perfumado','Esencia para hombre'],
   realistic_uses:['Rutina de ducha','Fragancia al salir'],likely_objections:['Qué incluye'],
   differentiators:['Dos productos para pasos distintos'],evidence_gaps:['Fórmula exacta','Duración del perfume']},
  evidence:[{claim:'NOIL shampoo perfumado para cuidado masculino',basis:'web',
    source_url:url,confidence:'medium'}],
  angle_analysis:[
   {angle:'rutina',buyer_motive:'Completitud',evidence_reason:'Uso de dos productos distintos',suitable_for:'Hombres',hypothesis:'Puede reducir dudas'},
   {angle:'combinación',buyer_motive:'Conveniencia',evidence_reason:'Doble función',suitable_for:'Rutina diaria',hypothesis:'Compra en combo'},
   {angle:'ocasión',buyer_motive:'Ocasión especial',evidence_reason:'Fragancia',suitable_for:'Salir',hypothesis:'Motivación emocional'},
  ],
  selected_sales_angle:'Rutina en dos pasos',description_conflicts:[],
  verified_claims:['Shampoo perfumado'],claims_to_verify:['Feromonas'],
  market_summary:'Interés hipotético en cuidado personal',audience_insights:['Hombres adultos'],
  research_limitations:['No hay datos de ventas'],recommended_index:1,concepts};
}
const wrapped=(r,{withWeb=true,urlOverride=url}={})=>({
 status:'completed',output:[
  ...(withWeb?[{type:'web_search_call',action:{sources:[{url:urlOverride,title:'NOIL - ficha oficial'}]}}]:[]),
  {type:'message',content:[{type:'output_text',text:JSON.stringify(r)}]},
 ],
});
test('investigation must search online, inspect image and return auditable product research before three ad concepts',()=>{
 const req=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna',REALIZO_ENV:'sandbox'},{
  id:'test-id',signedImage:'https://example.test/product.webp',product_name:'Combo NOIL + GODA',
  description:'Dos productos para cuidado masculino',market_code:'EC',creative_style:'ugc',
  video_model_id:'seedance-2.5-intl-omni-reference',video_duration_seconds:12,
  sales_angle:'auto',video_language:'es',
 });
 assert.equal(req.tool_choice,'required');
 assert.equal(req.max_tool_calls,5);
 assert.equal(req.reasoning.effort,'medium');
 assert.equal(req.tools[0].search_context_size,'medium');
 assert.match(req.instructions,/BUSCA EL PRODUCTO REAL EN INTERNET/);
 assert.match(req.instructions,/componentes\/ingredientes/);
 assert.match(req.instructions,/CONTRASTA/i);
 assert.match(req.instructions,/NMF/);
 assert.match(req.instructions,/HIPÓTESIS/);
 assert.equal(req.input[0].content[1].type,'input_image');
 const schema=researchSchema();
 assert.equal(schema.properties.product_dossier.type,'object');
 assert.equal(schema.properties.evidence.type,'array');
 assert.equal(schema.properties.angle_analysis.type,'array');
 assert.ok(schema.properties.concepts.items.required.includes('creative_style'));
});
test('grounded research rejects no web call, mismatched sources, unsupported identity, repetitive hooks, and wrong formats',()=>{
 const good=report();
 assert.equal(parseResearchResult(wrapped(good),{creativeStyle:'ugc',duration:12,requireGrounding:true}).report.concepts.length,3);
 assert.throws(()=>parseResearchResult(wrapped(good,{withWeb:false}),{creativeStyle:'ugc',duration:12,requireGrounding:true}),/research_invalid_content/);
 assert.throws(()=>parseResearchResult(wrapped(good,{urlOverride:'https://unrelated.example'}),{creativeStyle:'ugc',duration:12,requireGrounding:true}),/research_invalid_content/);
 assert.throws(()=>parseResearchResult(wrapped({...good,product_dossier:{...good.product_dossier,identity_status:'unverified'}}),{creativeStyle:'ugc',duration:12,requireGrounding:true}),/research_invalid_content/);
 assert.throws(()=>parseResearchResult(wrapped({...good,concepts:good.concepts.map(c=>({...c,hook:'El mismo hook'}))}),{creativeStyle:'ugc',duration:12,requireGrounding:true}),/research_invalid_content/);
 assert.throws(()=>parseResearchResult(wrapped({...good,concepts:good.concepts.map(c=>({...c,creative_style:'cinematic'}))}),{creativeStyle:'ugc',duration:12,requireGrounding:true}),/research_invalid_content/);
});
test('UGC, cinematic, premium, demo are differentiated in research AND final video direction',()=>{
 for(const style of Object.keys(FORMAT_GUIDES)){
  const plan=buildCommercialDirectorPackage({
   concept:{...report(style).concepts[0],angle:'benefits'},
   style:'auto',modelId:'seedance-2.5-intl-omni-reference',duration:12,
   productName:'Combo NOIL + GODA',description:'Shampoo y perfume',market:'EC',
  });
  assert.equal(plan.creative_style,style);
  assert.match(plan.prompt,new RegExp('FORMAT CONTRACT '+style.toUpperCase()));
  if(style==='ugc'){assert.equal(plan.shot_count,2);assert.match(plan.prompt,/UGC SALES REVIEW/);}
  if(style==='cinematic'){assert.match(plan.prompt,/CINEMATOGRAPHIC/);}
  if(style==='premium'){assert.match(plan.prompt,/PREMIUM COMMERCIAL/);}
  if(style==='demo'){assert.match(plan.prompt,/PRODUCT DEMONSTRATION/);}
 }
});
test('document research, purchase angle and verified evidence are present in app, no change to original wallet or customer price',()=>{
 const api=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(api,/requireGrounding:true/);
 assert.match(api,/research_evidence:report.evidence/);
 assert.match(api,/selected_sales_angle:report.selected_sales_angle/);
 assert.match(ui,/Motivos de compra analizados/);
 assert.match(ui,/Ver fuente/);
 assert.match(ui,/Ángulo recomendado por la investigación/);
 const pricing=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 assert.match(pricing,/premium_price_cents/);
 assert.match(pricing,/price_cents/);
 const audit=estimateOpenAIResearchCost({model:'gpt-6-luna',
  usage:{input_tokens:10000,input_tokens_details:{cached_tokens:0},output_tokens:1500},webCalls:5});
 assert.equal(audit.status,'estimated');
});
