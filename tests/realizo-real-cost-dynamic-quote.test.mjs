import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {quoteLiveVideo} from '../lib/wallet/live-video-models.js';

const originalFetch=globalThis.fetch;
const kling={name:'kling-o1-reference-to-video',category:'Image to Video',dynamic_pricing:true,
 endpoint:'/api/v1/kling-o1-reference-to-video',
 estimate_endpoint:'/api/v1/models/kling-o1-reference-to-video/estimate-cost',cost_currency:'USD'};
const omni={name:'seedance-2.5-intl-omni-reference',category:'Image to Video',dynamic_pricing:true,
 endpoint:'/api/v1/seedance-2.5-intl-omni-reference',
 estimate_endpoint:'/api/v1/models/seedance-2.5-intl-omni-reference/estimate-cost',cost_currency:'USD'};
const imagePayload={prompt:'UGC Spanish product demo',duration:8,aspect_ratio:'9:16',
 resolution:'720p',images_list:['https://example.org/image.jpg'],
 omni_reference_task_type:'reference'};
const okay=data=>({ok:true,status:200,json:async()=>data});
test.afterEach(()=>{globalThis.fetch=originalFetch});

test('Omni 2.5 receives the exact payload and real provider price, no internal price list',async()=>{
 let count=0;
 globalThis.fetch=async(url,opt={})=>{
  count++;
  assert.match(String(url),/^https:\/\/api\.muapi\.ai\/api\/v1\//);
  // Public estimate must not expose the server generation API key.
  assert.equal(opt.headers?.['x-api-key'],undefined);
  if(String(url).endsWith('/estimate-cost')){
   assert.deepEqual(JSON.parse(opt.body),imagePayload);
   return okay({cost:2.992,currency:'USD'});
  }
  return okay(omni);
 };
 const result=await quoteLiveVideo(omni.name,imagePayload,'secret-server-key');
 assert.deepEqual(result,{model_id:omni.name,endpoint:omni.name,provider_cost_cents:300});
 assert.equal(count,2);
});
test('Kling photo use is not arbitrarily prohibited; estimator response decides',async()=>{
 let calls=0;
 globalThis.fetch=async(url,opt={})=>{
  calls++;
  if(String(url).endsWith('/estimate-cost')){
   assert.deepEqual(JSON.parse(opt.body),{prompt:'Demo',images_list:['https://example.org/photo.png'],duration:7});
   return okay({cost:0.68,currency:'USD'});
  }
  return okay(kling);
 };
 const q=await quoteLiveVideo(kling.name,{prompt:'Demo',images_list:['https://example.org/photo.png'],duration:7});
 assert.equal(q.provider_cost_cents,68);
 assert.equal(calls,2);
});
test('Muapi 400 COST_CALC_FAILED is a provider estimator mismatch, not a catalog failure',async()=>{
 globalThis.fetch=async url=>String(url).endsWith('/estimate-cost')
  ?{ok:false,status:400,json:async()=>({error:{code:'COST_CALC_FAILED',message:"'video_url'"}})}
  :okay(kling);
 await assert.rejects(quoteLiveVideo(kling.name,{prompt:'Demo',duration:7,images_list:['https://example.org/p.jpg']}),/muapi_pricing_contract_mismatch/);
});
test('When model is available but its payload is invalid, show precise input error',async()=>{
 globalThis.fetch=async url=>String(url).endsWith('/estimate-cost')
  ?{ok:false,status:422,json:async()=>({detail:'invalid duration'})}
  :okay(omni);
 await assert.rejects(quoteLiveVideo(omni.name,imagePayload),/provider_price_inputs_invalid/);
});
test('fixed price is always taken from current Muapi catalog, not hardcoded',async()=>{
 globalThis.fetch=async()=>okay({...omni,dynamic_pricing:false,cost:0.723});
 const quote=await quoteLiveVideo(omni.name,imagePayload);
 assert.equal(quote.provider_cost_cents,73);
});
test('single-model error falls back to the publicly priced catalog',async()=>{
 const urls=[];
 globalThis.fetch=async url=>{
  urls.push(String(url));
  if(String(url).endsWith('/'+omni.name))return {ok:false,status:404};
  return okay({models:[{...omni,dynamic_pricing:false,cost:0.72}]});
 };
 assert.equal((await quoteLiveVideo(omni.name,imagePayload)).provider_cost_cents,72);
 assert.equal(urls.length,2);
});
test('a failed quote never fabricates an amount',async()=>{
 globalThis.fetch=async()=>({ok:false,status:503});
 await assert.rejects(quoteLiveVideo(omni.name,imagePayload),/muapi_catalog_unavailable/);
});
test('foreign currency never silently becomes USD',async()=>{
 globalThis.fetch=async url=>String(url).endsWith('/estimate-cost')
  ?okay({cost:1.2,currency:'EUR'}):okay(omni);
 await assert.rejects(quoteLiveVideo(omni.name,imagePayload),/unsupported_currency/);
});
test('sandbox wallet gates reserve only after a validated quote and explicit confirmation',()=>{
 const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
 const generate=readFileSync('app/api/wallet/generate/route.js','utf8');
 const client=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(quote,/ensureOwnedMedia\(env,user,body.input\)/);
 assert.match(quote,/quoteLiveVideo\(body.model_id,body.input,env.MUAPI_API_KEY\)/);
 assert.match(generate,/quoteLiveVideo\(body.model_id,body.input,env.MUAPI_API_KEY\)/);
 assert.match(generate,/quote\.provider_cost_cents>body\.max_price_cents/);
 assert.match(generate,/createReservedJob/);
 assert.match(client,/window\.confirm\(confirmMessage\)/);
});
test('Premium photo selector retains original allowed models, health is sandbox only',async()=>{
 const {premiumVideoOptions}=await import('../lib/realizo-creative/video-specs.js');
 assert.ok(premiumVideoOptions().some(x=>x.id===kling.name));
 assert.ok(premiumVideoOptions().some(x=>x.id===omni.name));
 const check=readFileSync('app/api/realizo/pricing/health/route.js','utf8');
 assert.match(check,/env.REALIZO_ENV!=='sandbox'/);
 assert.match(check,/quoteLiveVideo\(model/);
 assert.doesNotMatch(check,/MUAPI_API_KEY/);
});
