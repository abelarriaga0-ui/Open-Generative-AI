import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AD_TEMPLATES,getAdTemplate,validateAdTemplate,templatePlan,templateDirection} from '../lib/realizo-creative/ad-templates.js';
import {validatePremiumInput,buildResearchRequest,safeResearchResponse} from '../lib/realizo-creative/ai-premium.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
const read=p=>readFileSync(p,'utf8');
const studio=read('components/RealizoStudio.jsx'),premium=read('components/RealizoPremium.jsx');

test('eight templates have independent camera, editing, transition, audio, benefit and CTA directions',()=>{
 assert.equal(AD_TEMPLATES.length,8);
 assert.equal(new Set(AD_TEMPLATES.map(t=>t.id)).size,8);
 for(const t of AD_TEMPLATES){
  assert.ok(['ugc','cinematic','premium','demo'].includes(t.style));
  assert.ok(t.beats.length===5);
  for(const key of ['camera','editing','transition','audio','effect','angle','description'])assert.ok(t[key]?.length>=3);
  for(const seconds of [8,12,15,20,30]){
   const b=templatePlan(t.id,seconds);
   assert.equal(b[0].start,0);assert.ok(b[0].end<=3);assert.equal(b.at(-1).end,seconds);
   assert.ok(b.slice(1).every((beat,i)=>beat.start===b[i].end));
  }
  const dir=templateDirection(t.id,20,{actor:'hombre',setting:'baño real'});
  assert.match(dir,/TEMPLATE LOCKED/);
  assert.ok(dir.includes(t.camera));
  assert.ok(dir.includes(t.transition));
  assert.ok(dir.includes('hombre'));
 }
 assert.equal(getAdTemplate('missing'),null);
 assert.throws(()=>validateAdTemplate('unknown'),/invalid_ad_template/);
});

test('15-second UGC template is validated server-side and cannot change to another format',()=>{
 const value=validatePremiumInput({
  product_name:'NOIL',description:'Shampoo perfumado y aroma para uso diario',
  market:'EC',creative_style:'premium',template_id:'ugc-vendedor',
  template_actor:'hombre',template_setting:'baño privado',angle:'benefits',
  primary_asset_id:'00000000-0000-4000-8000-000000000000',
  request_key:'1234567890123456',video_model_id:'seedance-2.5-intl-omni-reference',
  video_duration_seconds:15
 });
 assert.equal(value.templateId,'ugc-vendedor');
 assert.equal(value.creativeStyle,'ugc');
 assert.equal(value.templateActor,'hombre');
 assert.equal(value.templateSetting,'baño privado');
 assert.throws(()=>validatePremiumInput({...{
  product_name:'NOIL',description:'Descripción válida del producto',
  market:'EC',primary_asset_id:'00000000-0000-4000-8000-000000000000',
  request_key:'1234567890123456',video_model_id:'seedance-2.5-intl-omni-reference',
  video_duration_seconds:15
 },template_id:'inject-template'}),/invalid_ad_template/);
});

test('paid research must receive locked template in the SAME OpenAI request without extra payment',()=>{
 const project={
  id:'test',signedImage:'https://example.org/product.jpg',product_name:'NOIL',description:'Shampoo perfumado',
  market_code:'EC',sales_angle:'benefits',creative_style:'ugc',video_language:'es',
  video_model_id:'seedance-2.5-intl-omni-reference',video_duration_seconds:15,
  template_id:'ugc-vendedor',template_actor:'hombre',template_setting:'baño'
 };
 const r=buildResearchRequest({OPENAI_PREMIUM_MODEL:'test',REALIZO_ENV:'sandbox'},project);
 assert.match(r.instructions,/PLANTILLA ELEGIDA POR EL CLIENTE/);
 assert.match(r.instructions,/TEMPLATE LOCKED: ugc-vendedor/);
 assert.match(r.instructions,/Los tres conceptos deben respetar el mismo storyboard/);
 assert.match(r.input[0].content[0].text,/template_id/);
 assert.equal(r.tool_choice,'required');assert.equal(r.max_tool_calls,5);
 assert.equal(r.input[0].content.filter(x=>x.type==='input_image').length,1);
});

test('final Muapi prompt contains exact preselected template before truncation',()=>{
 const d=buildCommercialDirectorPackage({
  concept:{name:'Rutina',creative_style:'ugc',hook:'¿Vas a salir?',
   spoken_script:'¿Vas a salir? Descubre NOIL y cómo completar tu rutina de cuidado. Conócelo y pide hoy.',
   video_prompt:'UGC vendedor ante cámara',cta:'Pídelo hoy'},
  productName:'NOIL',description:'Shampoo perfumado para cabello',
  duration:15,modelId:'seedance-2.5-intl-omni-reference',
  templateId:'ugc-vendedor',templateActor:'hombre',templateSetting:'baño',style:'ugc'
 });
 assert.equal(d.template_id,'ugc-vendedor');
 assert.match(d.prompt,/TEMPLATE LOCKED: ugc-vendedor/);
 assert.match(d.prompt,/JUMP|jump cuts/i);
 assert.match(d.prompt,/TRANSITIONS:/);
 assert.match(d.prompt,/SPOKEN SCRIPT/);
 assert.ok(d.prompt.indexOf('TEMPLATE LOCKED')<d.prompt.indexOf('FORMAT CONTRACT'));
 assert.ok(d.prompt.length<=5400);
});

test('template choice reaches project POST, persistence, approval and a prefilled editor',()=>{
 assert.match(studio,/function chooseAdTemplate\(id\)/);
 assert.match(studio,/setTemplateId\(item.id\)/);
 assert.match(studio,/initialTemplateId=\{templateId\}/);
 assert.match(studio,/RealizoTemplateLibrary featured onChoose=\{chooseAdTemplate\}/);
 assert.match(premium,/template_id:template\?\.id\|\|null/);
 assert.match(premium,/template_actor:templateActor,template_setting:templateSetting/);
 assert.match(premium,/realizo-v11-template-beats/);
 const route=read('app/api/realizo/ai-premium/route.js');
 assert.match(route,/template_id,template_actor,template_setting\) VALUES/);
 const approve=read('app/api/realizo/ai-premium/[id]/approve/route.js');
 assert.match(approve,/templateId:selectedTemplate\?\.id\|\|null/);
 assert.match(approve,/template_id:selectedTemplate\?\.id\|\|null/);
 assert.match(read('migrations/0022_realizo_ad_templates.sql'),/ALTER TABLE realizo_ai_projects ADD COLUMN template_id/);
 const css=read('app/realizo-premium-v11.css');
 assert.match(css,/realizo-v11-hero/);
 assert.match(css,/realizo-v11-cards/);
 assert.match(css,/realizo-v11-template-beats/);
 assert.match(read('app/layout.js'),/import '\.\/realizo-premium-v11.css'/);
});
