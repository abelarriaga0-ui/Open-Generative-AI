import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {quoteLiveVideo} from '../lib/wallet/live-video-models.js';
const original=globalThis.fetch;
const demo={name:'kling-o1-reference-to-video',category:'Image to Video',dynamic_pricing:true,
 endpoint:'/api/v1/kling-o1-reference-to-video',
 estimate_endpoint:'/api/v1/models/kling-o1-reference-to-video/estimate-cost',cost_currency:'USD'};
const payload={duration:7,aspect_ratio:'9:16',prompt:'Demo de producto'};
const okay=data=>({ok:true,status:200,json:async()=>data});
test.afterEach(()=>{globalThis.fetch=original});
test('quote uses individual Muapi model cost estimator without hardcoded tariffs',async()=>{
 const urls=[];
 globalThis.fetch=async(url,options={})=>{
  urls.push([String(url),options.method]);
  if(String(url).endsWith('/estimate-cost')){
    assert.deepEqual(JSON.parse(options.body),payload);
    return okay({currency:'USD',cost:0.7311});
  }
  if(String(url).endsWith('/kling-o1-reference-to-video'))return okay(demo);
  throw Error('unexpected request '+url);
 };
 const result=await quoteLiveVideo(demo.name,payload,'server-only-key');
 assert.equal(result.provider_cost_cents,74);
 assert.equal(result.endpoint,'kling-o1-reference-to-video');
 assert.equal(urls.length,2);
 assert.ok(urls.every(([url])=>url.startsWith('https://api.muapi.ai/api/v1/')));
});
test('live provider listing is used only if single-model lookup is unavailable',async()=>{
 const seen=[];
 globalThis.fetch=async(url)=>{
  seen.push(String(url));
  if(String(url).endsWith('/kling-o1-reference-to-video'))return {ok:false,status:503};
  if(String(url).endsWith('/models'))return okay({models:[{...demo,dynamic_pricing:false,cost:0.72}]});
  throw Error('unexpected');
 };
 const price=await quoteLiveVideo(demo.name,payload);
 assert.equal(price.provider_cost_cents,72);
 assert.equal(seen.length,2);
});
test('if Muapi cannot return a trustworthy price, there is NO charge and NO generation',async()=>{
 globalThis.fetch=async()=>({ok:false,status:503});
 await assert.rejects(quoteLiveVideo(demo.name,payload),/muapi_catalog_unavailable/);
});
test('unknown model must never receive a made-up fallback price',async()=>{
 globalThis.fetch=async(url)=>String(url).endsWith('/models')
  ?okay({models:[]}):{ok:false,status:404};
 await assert.rejects(quoteLiveVideo('some-unknown-model',payload),/unsupported_model/);
});
test('provider rejects foreign currency and malformed estimates',async()=>{
 globalThis.fetch=async url=>String(url).endsWith('/estimate-cost')
  ?okay({currency:'EUR',cost:1.23}):okay(demo);
 await assert.rejects(quoteLiveVideo(demo.name,payload),/unsupported_currency/);
});
test('API endpoints for quote and generation use only server Muapi key and preserve wallet confirmation',()=>{
 const q=readFileSync('app/api/wallet/quote/route.js','utf8');
 const g=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(q,/quoteLiveVideo\(body\.model_id,body\.input,env\.MUAPI_API_KEY\)/);
 assert.match(g,/quoteLiveVideo\(body\.model_id,body\.input,env\.MUAPI_API_KEY\)/);
 assert.match(g,/quote\.provider_cost_cents>body\.max_price_cents/);
 assert.match(g,/createReservedJob/);
});
