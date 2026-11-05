import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premiumVideoOptions} from '../lib/realizo-creative/video-specs.js';
import {resolvePremiumVideoSettings,buildPremiumGenerationParams} from '../lib/realizo-creative/premium-video-settings.js';
import {distinctConceptSpeeches} from '../lib/realizo-creative/sales-storyboard.js';
import {normalizeLiveVideoInput} from '../lib/wallet/live-video-models.js';

const text=path=>readFileSync(path,'utf8');
test('all initially selected model, aspect, resolution and quality settings are preserved',()=>{
 const models=premiumVideoOptions();
 assert.ok(models.length>10);
 const model=models.find(x=>x.id==='seedance-2.5-intl-omni-reference')||
   models.find(x=>x.image_role==='product_reference');
 assert.ok(model);
 const duration=model.durations[0];
 const presets=model.settings_by_duration[duration];
 assert.ok(Array.isArray(presets.resolutions));
 const settings=resolvePremiumVideoSettings(model.id,duration,{
  aspect_ratio:presets.aspect_ratios?.[0]||'',
  resolution:presets.resolutions?.[0]||'',
  quality:presets.qualities?.[0]||'',
 });
 const prepared=buildPremiumGenerationParams({
  modelId:model.id,duration,settings,prompt:'Real commercial video about a physical product.',
  imageUrl:'https://example.com/customer-owned-reference.png',
  workflowId:model.workflow_id,imageRole:model.image_role,
 });
 assert.equal(prepared.model,model.id);
 assert.equal(Number(prepared.duration),duration);
 assert.equal(prepared.prompt,'Real commercial video about a physical product.');
 assert.ok(Object.values(prepared).some(v=>
  v==='https://example.com/customer-owned-reference.png'||
  Array.isArray(v)&&v.includes('https://example.com/customer-owned-reference.png')));
 const input={...prepared};delete input.model;
 assert.deepEqual(normalizeLiveVideoInput(model.id,input),input);
 if(presets.resolutions.length)
  assert.equal(prepared.resolution,settings.resolution);
 if(presets.aspect_ratios.length)
  assert.equal(prepared.aspect_ratio,settings.aspect_ratio);
});
test('invalid resolution cannot be silently accepted after the user chose a model',()=>{
 const model=premiumVideoOptions().find(x=>x.resolutions.length>0);
 assert.ok(model);
 assert.throws(()=>resolvePremiumVideoSettings(model.id,model.durations[0],{
  resolution:'invalid-resolution'
 }),/invalid_video_configuration/);
});
test('Goda concepts with duplicated short voiceovers become distinct without a second AI call',()=>{
 const x={name:'Antes del saludo',spoken_script:'¿Quieres impresionarla? Goda perfume para salir. Pide Goda hoy.'};
 const concepts=[x,{...x,name:'Tu sello personal'},{...x,name:'Listo para salir'}];
 const diversified=distinctConceptSpeeches(concepts,{productName:'Goda',description:'Perfume masculino de esencia concentrada',duration:8,style:'premium',audioMode:'voiceover'});
 assert.equal(diversified.length,3);
 assert.equal(new Set(diversified.map(c=>c.spoken_script)).size,3);
 assert.equal(distinctConceptSpeeches(concepts,{productName:'Goda',description:'Perfume masculino',style:'premium',audioMode:'no_voice'}),concepts);
});
test('premium review edits speech per concept and directly invokes confirmed wallet generation',()=>{
 const ui=text('components/RealizoPremium.jsx');
 const studio=text('components/RealizoStudio.jsx');
 const approve=text('app/api/realizo/ai-premium/[id]/approve/route.js');
 const start=text('app/api/realizo/ai-premium/route.js');
 const migrate=text('migrations/0030_realizo_video_settings.sql');
 assert.match(ui,/speechEdits/);
 assert.match(ui,/Editar guion de este concepto/);
 assert.match(ui,/Aprobar concepto y generar/);
 assert.match(ui,/onWalletGenerate\(prepared.ready_for_generation/);
 assert.doesNotMatch(ui,/onPrepare\(json.ready_for_editor\);onOpenAdvanced\(\)/);
 assert.match(studio,/onWalletGenerate=\{onWalletGenerate\}/);
 assert.match(approve,/ready_for_generation:readyForGeneration/);
 assert.match(approve,/Object.hasOwn\(body,'speech'\)/);
 assert.match(approve,/project.video_settings_json/);
 assert.match(start,/video_settings_json/);
 assert.match(migrate,/ADD COLUMN video_settings_json/);
});
test('failed video responses disclose only controlled category and verified ledger release',()=>{
 const jobs=text('app/api/wallet/jobs/[id]/route.js');
 const front=text('lib/realizo-creative/wallet-generation.js');
 assert.match(jobs,/failure_code/);
 assert.match(jobs,/release_confirmed/);
 assert.match(jobs,/wallet_ledger WHERE user_id=/);
 assert.match(jobs,/classifyMuapiTaskFailure/);
 assert.match(front,/status.release_confirmed===true/);
 assert.match(front,/status.failure_code/);
 assert.doesNotMatch(front,/La generación falló; revisa la devolución de la reserva/);
});
