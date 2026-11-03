import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLiveVideoModel,quoteLiveVideo} from '../lib/wallet/live-video-models.js';

test('Seedance 2.0 Omni Reference uses Muapi current endpoint slug, never old model-id alias', async(t)=>{
 const old=globalThis.fetch;
 t.after(()=>{globalThis.fetch=old});
 const calls=[];
 globalThis.fetch=async(url,options={})=>{
   const path=new URL(String(url)).pathname;
   calls.push(path);
   if(path==='/api/v1/models/seedance-2-omni-reference')return Response.json({
     name:'seedance-2-omni-reference',category:'Image to Video',group_of:'video',
     is_enabled:1,dynamic_pricing:true,cost_currency:'USD',
     endpoint:'seedance-2.0-omni-reference',
     endpoint_url:'https://api.muapi.ai/api/v1/seedance-2-omni-reference',
     estimate_endpoint:'/api/v1/models/seedance-2-omni-reference/estimate-cost'
   });
   if(path==='/api/v1/models/seedance-2-omni-reference/estimate-cost'){
     assert.equal(options.method,'POST');
     const input=JSON.parse(options.body);
     assert.equal(input.duration,12);
     assert.equal(input.images_list.length,1);
     return Response.json({cost:{amount_usd:2.4},currency:'USD'});
   }
   throw Error('unexpected_request');
 };
 const model=await getLiveVideoModel('seedance-2-omni-reference');
 assert.equal(model.endpoint,'seedance-2.0-omni-reference');
 const quote=await quoteLiveVideo('seedance-2-omni-reference',{
   prompt:'@image1 reference product, realistic cinematic video',
   images_list:['https://realizo.example/picture.png'],duration:12,
   aspect_ratio:'9:16',quality:'basic'
 });
 assert.equal(quote.endpoint,'seedance-2.0-omni-reference');
 assert.equal(quote.provider_cost_cents,240);
 assert.ok(calls.every(s=>s.startsWith('/api/v1/models/')));
});

test('The producer refreshes stale provider endpoint only after trusted quote, before reserving credits',()=>{
 const source=readFileSync('app/api/wallet/generate/route.js','utf8');
 const update=source.indexOf('UPDATE model_prices SET muapi_endpoint=');
 const quote=source.indexOf('quote=await quoteLiveVideo(body.model_id,renderInput,env.MUAPI_API_KEY)');
 const reservation=source.indexOf("phase='wallet-reservation'");
 assert.ok(quote>=0 && update>quote && reservation>update);
 assert.match(source,/bind\(quote\.endpoint,quote\.model_id,quote\.endpoint\)/);
 assert.match(source,/isAllowedMuapiEndpoint\(model\.muapi_endpoint\)/);
});

test('Muapi endpoint cannot redirect to external host',async(t)=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old});
 globalThis.fetch=async()=>Response.json({
  name:'seedance-2-omni-reference',
  category:'Image to Video',group_of:'video',is_enabled:1,
  endpoint:'https://bad.example/api/v1/seedance-2.0-omni-reference'
 });
 await assert.rejects(getLiveVideoModel('seedance-2-omni-reference'),/unsupported_model_endpoint/);
});
