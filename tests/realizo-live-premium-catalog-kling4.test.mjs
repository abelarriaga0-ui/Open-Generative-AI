import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premiumVideoOptions,resolvePremiumVideoChoice} from '../lib/realizo-creative/video-specs.js';
import {resolvePremiumVideoSettings,buildPremiumGenerationParams} from '../lib/realizo-creative/premium-video-settings.js';
import {allPremiumVideoOptions,liveVideoOptionFromRecord,liveVideoSettingsForChoice,buildLivePremiumVideoInput} from '../lib/realizo-creative/premium-live-models.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {validatePremiumInput} from '../lib/realizo-creative/ai-premium.js';

const k4=[
 'kling-4.0-text-to-video','kling-4.0-reference-to-video',
 'kling-4.0-keyframe-to-video','kling-4.0-flash-text-to-video',
 'kling-4.0-flash-reference-to-video','kling-4.0-flash-keyframe-to-video'
];
test('Kling 4.0 & Flash text, reference and keyframe variants are selectable with documented settings',()=>{
 const list=premiumVideoOptions();
 for(const id of k4){
  const variant=list.find(o=>o.id===id);
  assert.ok(variant,'missing '+id);
  assert.match(variant.family,/Kling 4/);
  assert.equal(variant.provider,'kling');
  assert.equal(variant.prompt_max_length,8000);
  assert.equal(variant.durations[0],3);
  assert.equal(variant.durations.at(-1),id.includes('flash')?20:30);
  assert.ok(variant.resolutions.includes('720p'));
  assert.equal(variant.resolutions.includes('1080p'),!id.includes('flash'));
  assert.ok(variant.aspect_ratios.includes('9:16'));
  assert.equal(resolvePremiumVideoChoice(id,8).modelId,id);
 }
 assert.equal(list.find(o=>o.id==='kling-4.0-reference-to-video').image_role,'product_reference');
 assert.equal(list.find(o=>o.id==='kling-4.0-keyframe-to-video').image_role,'start_frame');
});
test('new Kling 4 request uses its own documented media field without swapping the purchased model',()=>{
 for(const id of ['kling-4.0-reference-to-video','kling-4.0-flash-reference-to-video',
  'kling-4.0-keyframe-to-video','kling-4.0-flash-keyframe-to-video']){
  const option=premiumVideoOptions().find(x=>x.id===id);
  const duration=8;
  const settings=resolvePremiumVideoSettings(id,duration,{aspect_ratio:'9:16',resolution:'720p'});
  const output=buildPremiumGenerationParams({
   modelId:id,duration,settings,workflowId:option.workflow_id,
   imageRole:option.image_role,prompt:'Sell the product with realistic human action.',
   imageUrl:'https://example.test/product.png'
  });
  assert.equal(output.model,id);
  assert.equal(output.duration,8);
  assert.equal(output.resolution,'720p');
  assert.ok(!Object.hasOwn(output,'images_list'));
  if(id.includes('reference')) assert.deepEqual(output.image_urls,['https://example.test/product.png']);
  else assert.equal(output.first_frame_url,'https://example.test/product.png');
 }
});
const newRecord={
 name:'example-5.1-reference-to-video',display_name:'Example 5.1 Reference',
 category:'Image to Video',provider:'example',
 input_schema:{type:'object',required:['prompt','image_urls'],properties:{
  prompt:{type:'string',maxLength:7000},image_urls:{type:'array',items:{type:'string'}},
  duration:{type:'integer',minimum:3,maximum:12},
  resolution:{type:'string',enum:['720p','1080p']},
  aspect_ratio:{type:'string',enum:['9:16','16:9']},
 }}
};
test('other providers and future versions with valid live API schema are discovered and validated',()=>{
 const option=liveVideoOptionFromRecord(newRecord);
 assert.ok(option);
 assert.equal(option.id,'example-5.1-reference-to-video');
 assert.equal(option.image_role,'product_reference');
 assert.equal(option.media_field,'image_urls');
 assert.equal(option.durations.length,10);
 assert.equal(option.prompt_max_length,7000);
 const settings=liveVideoSettingsForChoice(option,{aspect_ratio:'9:16',resolution:'1080p'});
 assert.equal(settings.resolution,'1080p');
 assert.throws(()=>liveVideoSettingsForChoice(option,{resolution:'4K'}),/invalid_video_configuration/);
 assert.deepEqual(buildLivePremiumVideoInput(option,{
  modelId:option.id,duration:8,settings,prompt:'Commercial with @image_1.',
  imageUrl:'https://example.test/verified.png'
 }),{model:option.id,prompt:'Commercial with @image_1.',duration:8,
  aspect_ratio:'9:16',resolution:'1080p',image_urls:['https://example.test/verified.png']});
 const body={
  product_name:'Example',description:'An everyday physical product with a real label.',
  market:'EC',angle:'auto',video_language:'es',creative_style:'premium',
  cast_mode:'with_people',audio_mode:'voiceover',primary_asset_id:'11111111-1111-4111-8111-111111111111',
  request_key:'case_future_video_2026',video_model_id:option.id,video_duration_seconds:8,
  video_aspect_ratio:'9:16',video_resolution:'1080p'
 };
 const validated=validatePremiumInput(body,{videoChoiceOverride:{
  modelId:option.id,duration:8,workflowId:'references',imageRole:'product_reference',option
 }});
 assert.equal(validated.videoSettings.model_contract.id,option.id);
 assert.equal(validated.videoSettings.resolution,'1080p');
});
test('unsafe, unpriced, unsupported or undocumented models do not become paid choices',()=>{
 assert.equal(liveVideoOptionFromRecord({...newRecord,is_coming_soon:true}),null);
 assert.equal(liveVideoOptionFromRecord({...newRecord,is_enabled:false}),null);
 assert.equal(liveVideoOptionFromRecord({...newRecord,name:'../../unsafe'}),null);
 assert.equal(liveVideoOptionFromRecord({...newRecord,input_schema:{...newRecord.input_schema,
  required:['prompt','private_key']}}),null);
 assert.equal(liveVideoOptionFromRecord({...newRecord,input_schema:{type:'object',
  properties:{prompt:{type:'string'}}}}),null);
 assert.equal(liveVideoOptionFromRecord(newRecord,new Set([newRecord.name])),null);
});
test('live public catalog extends stale built-in list, without any customer key or generated video',async()=>{
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  assert.equal(url,'https://api.muapi.ai/api/v1/models');
  assert.ok(!options.headers.Authorization && !options.headers['x-api-key']);
  return {ok:true,async json(){return {models:[newRecord]}}};
 };
 try{
  const options=await allPremiumVideoOptions();
  assert.ok(options.some(x=>x.id===newRecord.name));
  assert.ok(options.some(x=>x.id==='kling-4.0-reference-to-video'));
  assert.equal(calls,1);
 }finally{globalThis.fetch=original;}
});
test('Kling 4 prompt is compact and retains mandatory premium voice and actor locks',()=>{
 const p=buildCommercialDirectorPackage({
  productName:'Example',description:'Scent for daily personal care.',
  concept:{name:'Making a first impression',angle:'confidence',
   hook:'An inviting close-up',buyer_motive:'Express personal style',
   video_prompt:'Adult actors in an intimate evening setting with the real item',
   spoken_script:'A short Spanish line.',cta:'Conoce más'},
  market:'EC',duration:8,modelId:'kling-4.0-reference-to-video',
  workflowId:'references',style:'premium',castMode:'with_people',
  audioMode:'voiceover',promptMaxLength:7900
 });
 assert.ok(p.prompt.length<=7900);
 assert.match(p.prompt,/REALIZO LUXURY FILM CONTRACT v2/);
 assert.match(p.prompt,/MANDATORY NARRATION MODE/);
 assert.match(p.prompt,/CAST WITH_PEOPLE/);
 assert.match(p.prompt,/Express personal style/);
});
test('API reads live catalog and approval preserves verified settings without touching wallet logic',()=>{
 const get=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const approve=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(get,/video_options:await allPremiumVideoOptions\(\)/);
 assert.match(get,/resolveAnyPremiumVideoChoice/);
 assert.match(approve,/buildLivePremiumVideoInput/);
 assert.match(approve,/savedSettings\.model_contract/);
 assert.match(approve,/promptLimit/);
 assert.match(approve,/referenceTag/);
 assert.match(approve,/ready_for_generation:readyForGeneration/);
});
