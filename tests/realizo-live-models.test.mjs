import {test} from 'node:test';
import assert from 'node:assert/strict';
import {quoteLiveVideo,validateRelayMedia} from '../lib/wallet/live-video-models.js';
import {isOwnerMultiModelSandbox} from '../lib/wallet/multi-model-access.js';

const originalFetch=globalThis.fetch;
const models={models:[
 {name:'kling-3',category:'Image to Video',dynamic_pricing:true,is_enabled:true,
  endpoint:'/api/v1/kling-3',estimate_endpoint:'/api/v1/models/kling-3/estimate-cost'},
 {name:'wan2.2-image-to-video',category:'Image to Video',dynamic_pricing:false,cost:0.30,
  endpoint:'/api/v1/wan2.2-image-to-video'},
 {name:'unsupported',category:'Text to Image',dynamic_pricing:false,cost:0.01,
  endpoint:'/api/v1/unsupported'}
]};
const reply=(json,status=200)=>({ok:status===200,status,json:async()=>json});

test('catalog determines endpoint and live price per video configuration',async()=>{
 const seen=[];
 globalThis.fetch=async(url,opt={})=>{
  seen.push({url,options:opt});
  if(url==='https://api.muapi.ai/api/v1/models')return reply(models);
  if(url==='https://api.muapi.ai/api/v1/models/kling-3/estimate-cost')
    return reply({cost:0.64,currency:'USD'});
  throw Error('Unexpected URL '+url);
 };
 try {
  const input={prompt:'Muestra mi producto',duration:8,resolution:'720p'};
  const quote=await quoteLiveVideo('kling-3',input);
  assert.deepEqual(quote,{model_id:'kling-3',endpoint:'kling-3',provider_cost_cents:64});
  const estimated=seen.find(x=>x.url.endsWith('estimate-cost'));
  assert.deepEqual(JSON.parse(estimated.options.body),input);
  assert.equal(estimated.options.method,'POST');
 } finally {globalThis.fetch=originalFetch;}
});
test('fixed-price model works and unavailable model is rejected before spend',async()=>{
 globalThis.fetch=async()=>reply(models);
 try {
  const result=await quoteLiveVideo('wan2.2-image-to-video',{prompt:'A test'});
  assert.equal(result.provider_cost_cents,30);
  await assert.rejects(quoteLiveVideo('unsupported',{prompt:'A test'}),/unsupported_model/);
 } finally {globalThis.fetch=originalFetch;}
});
test('unsafe provider endpoint, webhook, and external media do not become spending requests',async()=>{
 globalThis.fetch=async()=>reply({models:[
  {name:'bad-slug',category:'Text to Video',dynamic_pricing:false,
   cost:2,endpoint:'https://private.example/video'}
 ]});
 try {
  await assert.rejects(quoteLiveVideo('bad-slug',{prompt:'hello'}),/unsupported_model_endpoint/);
  await assert.rejects(quoteLiveVideo('bad-slug',{webhook_url:'https://evil.example'}),/invalid_generation_request/);
  assert.throws(()=>validateRelayMedia({image_url:'https://bad.example/file.png'},
    'https://realizo.example','user'),/invalid_media_reference/);
 } finally {globalThis.fetch=originalFetch;}
});
test('multi-model spending is restricted to verified historical owner in Sandbox',async()=>{
 const user={id:'user-A'};
 const env={REALIZO_ENV:'sandbox',PAYPAL_MODE:'sandbox',REALIZO_AUTH_PROVIDER:'native',
  REALIZO_MULTI_MODEL_SANDBOX:'true',REALIZO_MUAPI_PILOT:'true',MUAPI_GENERATION_ENABLED:'true',
  REALIZO_MUAPI_PILOT_ACCOUNT_ID:user.id,
  WALLETS_DB:{prepare(sql){return {bind(id){return {first:async()=>{
   assert.match(sql,/realizo_prepaid_muapi_imports/);
   return id==='user-A'?{user_id:id}:null;
  }}}}}}
 };
 assert.equal(await isOwnerMultiModelSandbox(env,user),true);
 assert.equal(await isOwnerMultiModelSandbox(env,{id:'other'}),false);
 assert.equal(await isOwnerMultiModelSandbox({...env,REALIZO_MULTI_MODEL_SANDBOX:'false'},user),false);
});
