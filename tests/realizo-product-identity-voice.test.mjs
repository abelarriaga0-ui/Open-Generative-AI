import test from 'node:test';
import assert from 'node:assert/strict';
import {spokenOnly,spokenCta,productIdentityLock,RESEARCH_DELIVERABLE_CONTRACT} from '../lib/realizo-creative/creative-prompt-contracts.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {buildResearchRequest,parseResearchResult} from '../lib/realizo-creative/ai-premium.js';

const GODA={
 products:[
  {name:'GODA The Sense of Seduction For Him — frasco',container_type:'Frasco de vidrio oscuro',
   body_shape:'Cilindro compacto con hombros redondeados',closure_type:'Pera y gotero negro alto',main_colors:'Negro y etiqueta gris de letras negras'},
  {name:'GODA The Sense of Seduction For Him — caja',container_type:'Caja rectangular de cartón',
   body_shape:'Caja alta con texto GODA vertical',closure_type:'Cierre superior',main_colors:'Negro mate con letras blancas y trazos grises'}
 ],
 relative_pairs:[]
};
const raw='¿Y tu aroma? Quieres impresionarla, pero olvidas cómo hueles. Por eso usa Goda, perfume. Completa tu rutina. Rótulo final: «Pídelo por mensaje».';
test('produced GODA voice retains buying words but NEVER says video production directions',()=>{
 const speech=spokenOnly(raw);
 assert.match(speech,/¿Y tu aroma\?/);
 assert.match(speech,/Pídelo por mensaje/);
 assert.doesNotMatch(speech,/Rótulo final|«|»/);
 assert.equal(spokenCta('Rótulo final: «Pídelo por mensaje»'),'Pídelo por mensaje');
});
test('identity lock treats original SKU as immutable including the bottle AND box',()=>{
 const lock=productIdentityLock({product:'GODA',productGeometry:GODA,capabilities:{imageRole:'product_reference'},imageProvided:true});
 assert.match(lock,/IMMUTABLE PRODUCT SKU/);
 assert.match(lock,/NOT A GENERIC PRODUCT INSPIRED BY A PHOTO/);
 assert.match(lock,/GODA The Sense of Seduction For Him/);
 assert.match(lock,/Pera y gotero negro alto/);
 assert.match(lock,/Caja alta con texto GODA vertical/);
 assert.match(lock,/do not.*rebrand|Do not redesign, rebrand/i);
 assert.match(lock,/No generated subtitles/);
});
function pkg(style){
 return buildCommercialDirectorPackage({
  concept:{creative_style:style,angle:'preparación para una cita',
   hook:'¿Y tu aroma?',name:'Goda real',spoken_script:raw,
   cta:'Rótulo final: «Pídelo por mensaje»',buyer_motive:'Primera impresión'},
  productName:'GODA',description:'Esencia concentrada de perfume para hombres',
  duration:8,style,modelId:'seedance-2.5-intl-omni-reference',workflowId:'references',
  castMode:style==='premium'?'product_only':'with_people',audioMode:style==='premium'?'no_voice':'dialogue',
  imageProvided:true,productGeometry:GODA,market:'EC',videoLanguage:'es'
 });
}
test('UGC prioritizes visual SKU and human-only voice, with no fake subtitle CTA',()=>{
 const p=pkg('ugc');
 assert.match(p.prompt,/P0 \/ IMMUTABLE PRODUCT SKU/);
 assert.match(p.prompt,/GODA.*frasco/);
 assert.match(p.prompt,/GODA.*caja/);
 assert.equal(p.spoken_script,spokenOnly(raw));
 assert.equal(p.cta,'Pídelo por mensaje');
 assert.ok(p.prompt.length<=12500);
});
test('Demo and Premium get the SAME immutability and no CGI lettering',()=>{
 for(const style of ['demo','premium','cinematic']){
  const p=pkg(style);
  assert.match(p.prompt,/IMMUTABLE PRODUCT SKU/);
  assert.match(p.prompt,/printed artwork/);
  assert.match(p.prompt,/No generated subtitles/);
  assert.ok(p.prompt.length<=12500);
 }
});
test('product research uses high reasoning without second LLM charge and forbids stage words',()=>{
 const project={
   id:'project',product_name:'GODA',description:'Perfume concentrado con presentación de gotero',
   market_code:'EC',video_language:'es',video_duration_seconds:8,
   video_model_id:'seedance-2.5-intl-omni-reference',video_workflow_id:'references',
   creative_style:'ugc',cast_mode:'with_people',audio_mode:'dialogue',
   signedImage:'https://example.invalid/goda.jpg',
 };
 const r=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},project);
 assert.equal(r.reasoning.effort,'high');
 assert.equal(r.max_tool_calls,5);
 assert.ok(r.max_output_tokens<=14000);
 assert.equal(r.tools[0].type,'web_search');
 assert.ok(r.instructions.includes(RESEARCH_DELIVERABLE_CONTRACT));
});
test('paid response parser cleans metadata from voice and CTA prior to customer approval',()=>{
 const concept={
  name:'Salida',angle:'scent',creative_style:'ugc',hook:'¿Y tu aroma?',
  spoken_script:raw,script:raw,video_prompt:'Human actor preparing to go out',
  cta:'Rótulo final: «Pídelo por mensaje»',shots:['Hook','CTA'],restrictions:[]
 };
 const data={status:'completed',output:[{type:'message',content:[{type:'output_text',
   text:JSON.stringify({recommended_index:0,concepts:[concept,{...concept,name:'B'},{...concept,name:'C'}]})}]}]};
 const output=parseResearchResult(data,{creativeStyle:'demo',duration:8});
 assert.equal(output.report.concepts[0].cta,'Pídelo por mensaje');
 assert.doesNotMatch(output.report.concepts[0].spoken_script,/Rótulo/);
});
