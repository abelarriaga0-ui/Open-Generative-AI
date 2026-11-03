import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyUserTemplate,normalizeSavedTemplate,templateSourceFromVideo} from '../lib/realizo-creative/user-templates.js';
import {walletPilotAction} from '../lib/wallet/request-policy.js';

test('auto-detects UGC, premium cinema, demonstrations and commercials',()=>{
 assert.equal(classifyUserTemplate({prompt:'UGC selfie testimonial, cinematic phone footage'}),'ugc');
 assert.equal(classifyUserTemplate({prompt:'REALIZO LUXURY FILM CONTRACT v2 STYLE PREMIUM, NOT UGC, NOT A DEMO'}),'cine_premium');
 assert.equal(classifyUserTemplate({prompt:'Realiza una demostración paso a paso del producto'}),'demostracion');
 assert.equal(classifyUserTemplate({prompt:'Anuncio comercial de venta directa con CTA'}),'comercial');
 assert.equal(classifyUserTemplate({prompt:'Una idea abstracta original'}),'otros');
});

test('saving a personal template preserves original model and reusable prompt with no media',()=>{
 const source={prompt:'PRODUCT NAME (IDENTIFICATION ONLY): Nippori. Luxury film, no voice, three studio shots.',
  model_id:'veo3.1-reference-to-video',duration_seconds:8,workflow_id:'references'};
 const normalized=normalizeSavedTemplate(source);
 assert.equal(normalized.category,'cine_premium');
 assert.equal(normalized.title,'Cine Premium · Nippori');
 assert.equal(normalized.model_id,source.model_id);
 assert.equal(normalized.prompt,source.prompt);
 assert.equal(normalized.duration_seconds,8);
 assert.equal(normalized.workflow_id,'references');
 assert.throws(()=>normalizeSavedTemplate({...source,model_id:'https://arbitrary-host.test/submit'}),/invalid_template/);
 assert.throws(()=>normalizeSavedTemplate({...source,prompt:'x'}),/invalid_template/);
});

test('job template source does not preserve uploaded photos, card details or provider endpoints',()=>{
 const source=templateSourceFromVideo({
  prompt:'PRODUCT NAME: Flexacil Ultra. UGC testimonial with original dialogue, no exaggerated claims.',
  duration:12,images_list:['https://example.com/private?sig=secret'],
  api_key:'secret',video_url:'https://example.com/private-video'
 },'seedance-2-image-to-video');
 const payload=JSON.parse(source);
 assert.equal(payload.model_id,'seedance-2-image-to-video');
 assert.equal(payload.duration_seconds,12);
 assert.equal(payload.workflow_id,'animate_image');
 assert.equal(payload.images_list,undefined);
 assert.doesNotMatch(source,/sig=secret|api_key|private-video/);
});

test('private endpoints are reachable only in native authenticated app and remain narrowly scoped',()=>{
 const uuid='11111111-1111-4111-8111-111111111111';
 assert.equal(walletPilotAction('/api/realizo/user-templates',true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/user-templates/'+uuid,true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/user-templates',true,false),'deny');
 assert.equal(walletPilotAction('/api/realizo/user-templates/abc',true,true),'deny');
 for(const path of ['app/api/realizo/user-templates/route.js','app/api/realizo/user-templates/[id]/route.js']){
  const source=readFileSync(path,'utf8');
  assert.match(source,/requireWalletUser/);
  assert.match(source,/user\.id/);
  assert.match(source,/user_id=\?/);
 }
});

test('private templates migrate without modifying wallet balances or generation pricing',()=>{
 const sql=readFileSync('migrations/0027_realizo_user_templates.sql','utf8');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS realizo_user_templates/);
 assert.match(sql,/ALTER TABLE generation_jobs ADD COLUMN template_source_json/);
 assert.doesNotMatch(sql,/UPDATE wallets|UPDATE model_prices|DELETE FROM wallet_ledger|INSERT INTO verified_deposits/i);
 const video=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 const library=readFileSync('components/RealizoTemplateLibrary.jsx','utf8');
 const history=readFileSync('components/RealizoStudio.jsx','utf8');
 assert.match(video,/Guardar plantilla/);
 assert.match(library,/Mis plantillas/);
 assert.match(history,/Guardar como plantilla/);
});
