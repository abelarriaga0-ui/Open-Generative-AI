import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseResearchResult} from '../lib/realizo-creative/ai-premium.js';

const source=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
const ui=readFileSync('components/RealizoPremium.jsx','utf8');
const model=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
test('failed Premium research exposes diagnostic reason and accurate payment state',()=>{
 assert.match(source,/response\.research_payment_status=order\?\.status/);
 assert.match(source,/quality\.billable/);
 assert.match(source,/quality\.needsReview/);
 assert.match(ui,/research_quality\.reasons/);
 assert.match(ui,/research_output_incomplete/);
 assert.match(ui,/research_web_not_performed/);
 assert.match(ui,/project\.research_payment_status==='released'/);
 assert.match(ui,/Investigación parcial/);
});
test('recovery reuses the original provider response, never POSTs to OpenAI twice',()=>{
 const segment=source.slice(source.indexOf('export async function POST(request,{params})'));
 assert.match(segment,/enforceSameOrigin\(request\)/);
 assert.match(segment,/requireWalletUser\(request,env\)/);
 assert.match(segment,/user_id=\?/);
 assert.match(segment,/status='failed'/);
 assert.match(segment,/error_code='unusable_research'/);
 assert.match(segment,/provider_response_id IS NOT NULL/);
 assert.match(segment,/recovery_existing_response/);
 assert.doesNotMatch(segment,/startOpenAIResearch|openai\.com|payment.*captured/i);
 assert.match(ui,/Recuperar respuesta existente/);
 assert.match(ui,/recovery_available/);
 assert.match(model,/recovery_available:project\.status==='failed'/);
});
test('strict web research checks actual tool usage but limited results remain honest and unbilled',()=>{
 const partial={
  product_observation:'El usuario muestra un frasco de un shampoo poco documentado',
  product_dossier:{identified_product:'NOIL',identity_status:'unverified',actual_category:'shampoo',
    manufacturer_or_brand:'NOIL',components_or_ingredients:[],features:[],realistic_uses:[],
    likely_objections:[],differentiators:[],evidence_gaps:['Composición sin verificar']},
  evidence:[],angle_analysis:[],selected_sales_angle:'Rutina diaria',
  description_conflicts:[],verified_claims:[],claims_to_verify:['Composición'],
  market_summary:'No se identificaron datos suficientes',audience_insights:[],
  research_limitations:['No se encontró documentación'],recommended_index:0,
  concepts:[0,1,2].map(i=>({name:'Propuesta '+i,angle:'beneficios',creative_style:'ugc',
    reason:'Rutina',buyer_motive:'Preparación personal',hook:['¿Qué te falta?','¿Buscas un cambio?','¿Y tu rutina?'][i],
    script:'Guion',spoken_script:'¿Quieres completar tu rutina? Este producto puede formar parte de tu cuidado personal. Revisa sus características y decide si te conviene. Pide información.',
    video_prompt:'Adulto hablando a cámara',cta:'Pregunta hoy',shots:['habla a cámara'],
    restrictions:['Sin afirmaciones no verificadas'],key_evidence_claims:[] })),
 };
 const data={status:'completed',output:[{type:'web_search_call',action:{sources:[]}},
  {type:'message',content:[{type:'output_text',text:JSON.stringify(partial)}]}]};
 const res=parseResearchResult(data,{creativeStyle:'ugc',duration:12,requireGrounding:true});
 assert.equal(res.report.concepts.length,3);
 assert.equal(res.quality.billable,false);
 assert.ok(res.quality.reasons.length>0);
 assert.throws(()=>parseResearchResult({...data,output:[data.output[1]]},
  {creativeStyle:'ugc',duration:12,requireGrounding:true}),/research_web_not_performed/);
});
