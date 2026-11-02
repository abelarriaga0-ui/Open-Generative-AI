import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePremiumInput,buildResearchRequest,researchFingerprint,parseResearchResult} from '../lib/realizo-creative/ai-premium.js';
import {premiumVideoOptions} from '../lib/realizo-creative/video-specs.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';

const model=premiumVideoOptions().find(m=>m.durations.includes(12)&&m.image_role==='product_reference')
 ||premiumVideoOptions().find(m=>m.image_role==='product_reference')
 ||premiumVideoOptions()[0];
const seconds=model.durations.includes(12)?12:model.durations[0];
const form={description:'Shampoo perfumado NOIL junto a esencia de perfume GODA para hombre',market:'EC',angle:'benefits',
 primary_asset_id:'00000000-0000-4000-8000-000000000001',request_key:'ugcclientrequest0001',
 video_model_id:model.id,video_duration_seconds:seconds,creative_style:'ugc'};
test('UGC style is chosen before charging and travels into the research request',()=>{
 const validated=validatePremiumInput(form);
 assert.equal(validated.creativeStyle,'ugc');
 assert.throws(()=>validatePremiumInput({...form,creative_style:'fakeUGC'}),/invalid_request/);
 const payload=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},{
  product_name:'Combo NOIL + GODA',description:form.description,market_code:'EC',
  sales_angle:'benefits',creative_style:'ugc',video_language:'es',
  video_model_id:model.id,video_duration_seconds:seconds,
  video_workflow_id:model.workflow_id,signedImage:'https://example.test/products.jpg',
  id:'project-ugc'
 });
 assert.match(payload.instructions,/UGC DE VENTA/);
 assert.match(payload.instructions,/70-85%/);
 assert.match(payload.instructions,/GANCHO HABLADO/);
 assert.match(payload.instructions,/RESPETO DEL TEXTO COMERCIAL/);
 assert.match(payload.input[0].content[0].text,/creative_style/);
});
test('UGC research fingerprint is different from the silent cinematic option',async()=>{
 const data=validatePremiumInput(form);
 assert.notEqual(await researchFingerprint(data),await researchFingerprint({...data,creativeStyle:'cinematic'}));
});
test('vacuous UGC output does not get accepted as a valid paid research result',()=>{
 const concept={name:'UGC de venta',angle:'ugc',hook:'¿Tu rutina se queda corta?',
  spoken_script:'Listo, compra ahora.',video_prompt:'Actor talking to camera in bathroom throughout ad',
  shots:['Primer plano','CTA'],script:'',cta:'Pide el combo',restrictions:[],reason:'Review'};
 const report={product_observation:'Dos productos',description_conflicts:[],verified_claims:[],
  claims_to_verify:[],market_summary:'Routine',audience_insights:[],research_limitations:[],
  recommended_index:0,concepts:[concept,{...concept,name:'Opción 2'},{...concept,name:'Opción 3'}]};
 const response={status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(report)}]}]};
 assert.throws(()=>parseResearchResult(response,{creativeStyle:'ugc',duration:12}),/research_invalid_content/);
 assert.equal(parseResearchResult(response).report.concepts.length,3);
 const good={...concept,spoken_script:'¿Te arreglas para salir? Completa tu rutina con NOIL para el cabello y GODA como toque final. Descubre este combo y pídelo hoy.'};
 const valid={...report,concepts:[good,{...good,name:'Opción 2'},{...good,name:'Opción 3'}]};
 assert.equal(parseResearchResult({...response,output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(valid)}]}]},{creativeStyle:'ugc',duration:12}).report.concepts.length,3);
});
test('no extra AI on script edits; UGC voice and aspect are attached to the approved model',()=>{
 const source=readFileSync('components/RealizoPremium.jsx','utf8');
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 const migration=readFileSync('migrations/0019_realizo_premium_creative_style.sql','utf8');
 assert.match(source,/initialStyle='ugc'/);
 assert.match(source,/creative_style:template\?\.style\|\|initialStyle/);
 assert.match(source,/onClick=\{\(\)=>change\('creative_style',id\)\}/);
 assert.match(source,/Editar guion hablado sin costo adicional/);
 assert.match(source,/speech:editedSpeech/);
 assert.match(approval,/spoken_script:userSpeech/);
 assert.match(approval,/project.creative_style/);
 assert.doesNotMatch(approval,/ugc_speech_timing_invalid/);
 assert.match(source,/objetivo.*speechMin/);

 assert.match(editor,/setSelectedAr\('9:16'\)/);
 assert.match(migration,/ADD COLUMN creative_style/);
 const director=buildCommercialDirectorPackage({
   concept:{name:'Beneficios',angle:'benefits',hook:'¿Tu rutina se queda corta?',
    spoken_script:'¿Tu rutina se queda corta? Aquí tienes NOIL para el cabello y GODA para dar el toque final a tu perfume. Conoce el combo y pídelo hoy.',
    shots:['hombre frente a espejo','shampoo','perfume','frascos quietos']},
   style:'ugc',shotPreference:'multi',duration:12,modelId:'seedance-2.5-intl-omni-reference',
   productName:'Combo NOIL + GODA',description:form.description,
 });
 assert.equal(director.shot_count,2);
 assert.match(director.prompt,/70-85%/);
 assert.match(director.prompt,/direct-to-camera review/);
 assert.doesNotMatch(director.prompt,/RESEARCHED SHOT IDEAS/);
});
