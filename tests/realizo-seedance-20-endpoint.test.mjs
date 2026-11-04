import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getLiveVideoModel,quoteLiveVideo,verifyLiveVideoPostRoute,resolveLiveVideoPostRoute} from '../lib/wallet/live-video-models.js';

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
 const quote=source.indexOf('quote=await quoteLiveVideo(body.model_id,renderInput,env.MUAPI_API_KEY,{requireLivePostRoute:true})');
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

test('Seedance 2.5 International Omni Reference uses the published POST route, never stale catalog slugs',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
 const modelId='seedance-2.5-intl-omni-reference';
 const seen=[];
 globalThis.fetch=async(url,options={})=>{
  const path=new URL(String(url)).pathname;seen.push(path);
  if(path==='/api/v1/models/'+modelId)return Response.json({
   name:modelId,category:'Image to Video',is_enabled:true,
   dynamic_pricing:true,cost_currency:'USD',
   endpoint:'seedance-2.0-omni-reference',
   endpoint_url:'https://api.muapi.ai/api/v1/seedance-2.5-intl-omni-reference',
   estimate_endpoint:'/api/v1/models/'+modelId+'/estimate-cost'
  });
  if(path==='/api/v1/models/'+modelId+'/estimate-cost'){
   assert.equal(options.method,'POST');
   return Response.json({cost:{amount_usd:3.74},currency:'USD'});
  }
  throw Error('Unexpected URL '+url);
 };
 const fetched=await getLiveVideoModel(modelId);
 assert.equal(fetched.endpoint,'seedance-2.5-intl-omni-reference');
 const quoted=await quoteLiveVideo(modelId,{
  prompt:'Commercial live action product',duration:10,
  images_list:['https://realizo.example/candela.png'],
  resolution:'720p',aspect_ratio:'9:16'
 });
 assert.equal(quoted.endpoint,modelId);
 assert.equal(quoted.provider_cost_cents,374);
 assert.ok(seen.every(x=>x.startsWith('/api/v1/models/')));
});

test('all documented Seedance 2.5 variant routes override stale aliases without changing user choice',async(t)=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old});
 for(const id of [
  'seedance-2.5-omni-reference',
  'seedance-2.5-intl-image-to-video',
  'seedance-2.5-intl-text-to-video'
 ]){
  globalThis.fetch=async()=>Response.json({
   id,category:'Text to Video',is_enabled:true,
   endpoint:'old-retired-2-0-route',
   endpoint_url:'https://api.muapi.ai/api/v1/obsolete-route'
  });
  const result=await getLiveVideoModel(id);
  assert.equal(result.endpoint,id);
 }
});

test('non-Seedance models use a safe canonical endpoint_url before old legacy slug',async(t)=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old});
 globalThis.fetch=async()=>Response.json({
  name:'kling-live',category:'Image to Video',is_enabled:true,
  endpoint:'kling-retired',
  endpoint_url:'https://api.muapi.ai/api/v1/kling-live',
 });
 const model=await getLiveVideoModel('kling-live');
 assert.equal(model.endpoint,'kling-live');
});

test('provider 404 is a failed request releasing the reservation without retrying paid generation',()=>{
 const route=readFileSync('app/api/wallet/generate/route.js','utf8');
 const status=route.indexOf("if (response.status >= 400 && response.status < 500)");
 const release=route.indexOf("await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, failure);");
 assert.ok(status>=0 && release>status,'release the wallet reservation on upstream model rejection');
 const ledger=readFileSync('migrations/0001_wallet.sql','utf8');
 assert.match(ledger,/CREATE TRIGGER IF NOT EXISTS generation_release_after_failure/);
 assert.match(ledger,/available_cents = available_cents \+ NEW.price_cents/);
});

test('Seedance 2.0 Standard References 15s uses official no-video route, not a stale catalog alias',async(t)=>{
 const original=globalThis.fetch;
 t.after(()=>{globalThis.fetch=original});
 const modelId='seedance-2-omni-reference-no-video';
 const seen=[];
 globalThis.fetch=async(url,options={})=>{
  const pathname=new URL(String(url)).pathname;
  seen.push(pathname);
  if(pathname==='/api/v1/models/'+modelId)return Response.json({
   id:modelId,category:'Image to Video',group_of:'video',
   is_enabled:true,dynamic_pricing:true,cost_currency:'USD',
   // Reproduce a stale Muapi catalog alias: both returned endpoints are wrong.
   endpoint:'seedance-2.0-omni-reference',
   endpoint_url:'https://api.muapi.ai/api/v1/seedance-2-omni-reference',
   estimate_endpoint:'/api/v1/models/'+modelId+'/estimate-cost'
  });
  if(pathname==='/api/v1/models/'+modelId+'/estimate-cost'){
   assert.equal(options.method,'POST');
   const input=JSON.parse(options.body);
   assert.equal(input.duration,15);
   assert.equal(input.aspect_ratio,'9:16');
   assert.deepEqual(input.images_list,['https://realizo.example/candela.png']);
   assert.equal(input.video_files,undefined,'No video required for this workflow');
   return Response.json({cost:{amount_usd:4.35},currency:'USD'});
  }
  throw Error('unexpected_public_muapi_endpoint_'+pathname);
 };
 const model=await getLiveVideoModel(modelId);
 assert.equal(model.endpoint,'seedance-2-omni-reference-no-video');
 const quote=await quoteLiveVideo(modelId,{
  prompt:'@image1 authentic Candela UGC commercial with spoken dialogue',
  images_list:['https://realizo.example/candela.png'],
  duration:15,aspect_ratio:'9:16'
 });
 assert.equal(quote.model_id,modelId);
 assert.equal(quote.endpoint,'seedance-2-omni-reference-no-video');
 assert.equal(quote.provider_cost_cents,435);
 assert.ok(seen.every(path=>path.startsWith('/api/v1/models/')),
  'Quote preflight must never submit a paid generation');
});

test('Seedance 2.0 legacy Omni (supports input videos) stays distinct from no-video References',async(t)=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
 globalThis.fetch=async()=>Response.json({
  name:'seedance-2-omni-reference',
  category:'Image to Video',is_enabled:true,
  endpoint:'seedance-2.0-omni-reference',
  endpoint_url:'https://api.muapi.ai/api/v1/seedance-2-omni-reference'
 });
 const legacy=await getLiveVideoModel('seedance-2-omni-reference');
 assert.equal(legacy.endpoint,'seedance-2.0-omni-reference');
 assert.notEqual(legacy.endpoint,'seedance-2-omni-reference-no-video');
});

test('publisher carries the exact quoted Muapi slug to the POST request without mutating user selection',()=>{
 const backend=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(backend,/quote=await quoteLiveVideo\(body.model_id,renderInput,env.MUAPI_API_KEY\)/);
 assert.match(backend,/model=\{model_id:quote.model_id,muapi_endpoint:quote.endpoint/);
 assert.match(backend,/fetch\('https:\/\/api.muapi.ai\/api\/v1\/' \+ model.muapi_endpoint/);
 assert.match(backend,/response.status >= 400 && response.status < 500/);
});

test('REAL production regression: legacy Seedance 2 Omni model uses endpoint_url instead of HTTP 404 catalog endpoint',async(t)=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old});
 const events=[];
 const modelId='seedance-2-omni-reference';
 globalThis.fetch=async(url,opts={})=>{
  const pathname=new URL(String(url)).pathname;
  const method=opts.method||'GET';
  events.push({pathname,method,headers:opts.headers});
  if(pathname==='/api/v1/models/'+modelId)return Response.json({
   name:modelId,category:'Image to Video',is_enabled:1,
   dynamic_pricing:true,cost_currency:'USD',
   // Exact live Muapi catalog behavior audited Nov 4, 2026:
   endpoint:'/api/v1/seedance-2-omni-reference', // 404
   endpoint_url:'seedance-2.0-omni-reference', // 405 Allow: POST
   estimate_endpoint:'/api/v1/models/'+modelId+'/estimate-cost'
  });
  if(pathname==='/api/v1/seedance-2.0-omni-reference' && method==='GET')
   return new Response('',{status:405,headers:{Allow:'POST'}});
  if(pathname==='/api/v1/models/'+modelId+'/estimate-cost' && method==='POST'){
   const input=JSON.parse(opts.body);
   assert.equal(input.duration,15);
   assert.deepEqual(input.images_list,['https://realizo.example/candela.png']);
   return Response.json({cost:{amount_usd:4.25},currency:'USD'});
  }
  if(pathname==='/api/v1/seedance-2-omni-reference')return new Response('',{status:404});
  throw Error('unrecognized probe '+method+' '+pathname);
 };
 const resolved=await getLiveVideoModel(modelId);
 assert.equal(resolved.endpoint,'seedance-2.0-omni-reference');
 const quote=await quoteLiveVideo(modelId,{
  prompt:'@image1 Candela UGC, authentic real-life skincare commercial',
  images_list:['https://realizo.example/candela.png'],
  duration:15,aspect_ratio:'9:16'
 },'',{requireLivePostRoute:true});
 assert.equal(quote.model_id,modelId,'never switch selected model');
 assert.equal(quote.endpoint,'seedance-2.0-omni-reference');
 assert.equal(quote.provider_cost_cents,425);
 assert.ok(events.some(e=>e.pathname==='/api/v1/seedance-2.0-omni-reference'&&e.method==='GET'));
 assert.ok(!events.some(e=>e.pathname==='/api/v1/seedance-2-omni-reference'));
 assert.ok(!events.some(e=>e.method==='POST'&&!e.pathname.includes('/estimate-cost')),
  'the preflight and tests MUST NOT perform a paid provider generation');
 assert.ok(!events.some(e=>Object.keys(e.headers||{}).some(k=>k.toLowerCase()==='x-api-key')),
  'public GET probes and estimators must never receive the platform API key');
});

test('every model validates the real POST route by non-billing GET, not by a model alias',async(t)=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old});
 const routes=[];
 globalThis.fetch=async(url,opts={})=>{
  const pathname=new URL(String(url)).pathname;
  assert.equal(opts.method,'GET');
  routes.push(pathname);
  if(pathname==='/api/v1/deprecated-catalog-alias')return new Response('',{status:404});
  if(pathname==='/api/v1/verified-model-route')
   return new Response('',{status:405,headers:{Allow:'POST'}});
  throw Error('Unexpected route '+pathname);
 };
 assert.equal(await verifyLiveVideoPostRoute('verified-model-route'),true);
 assert.equal(await verifyLiveVideoPostRoute('deprecated-catalog-alias'),false);
 const route=await resolveLiveVideoPostRoute({
  endpoint_url:'deprecated-catalog-alias',
  endpoint:'/api/v1/verified-model-route',
 },'some-video-model');
 assert.equal(route,'verified-model-route');
 assert.ok(routes.includes('/api/v1/deprecated-catalog-alias'));
 assert.ok(routes.includes('/api/v1/verified-model-route'));
});

test('dead or ambiguous routes stop all 400+ video families before wallet reservation',async(t)=>{
 const old=globalThis.fetch;t.after(()=>{globalThis.fetch=old});
 globalThis.fetch=async(url,opts={})=>{
  const p=new URL(String(url)).pathname;
  if(p==='/api/v1/models/missing-video')return Response.json({
   name:'missing-video',category:'Image to Video',is_enabled:1,
   endpoint_url:'retired-route',endpoint:'/api/v1/retired-alias',
   dynamic_pricing:true,estimate_endpoint:'/api/v1/models/missing-video/estimate-cost'
  });
  if(opts.method==='GET'&&p.startsWith('/api/v1/retired'))
   return new Response('',{status:404});
  throw Error('The preflight must not submit a paid generation or even estimate its price');
 };
 await assert.rejects(quoteLiveVideo('missing-video',{
  prompt:'video',duration:15
 },'',{requireLivePostRoute:true}),/muapi_generation_route_not_found/);
 globalThis.fetch=async()=>new Response('',{status:403});
 await assert.rejects(verifyLiveVideoPostRoute('unverifiable-video-route'),/muapi_generation_route_unverifiable/);
});

test('quote and paid generate both require live POST routing before any reservation',()=>{
 const quote=readFileSync('app/api/wallet/quote/route.js','utf8');
 const generate=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(quote,/quoteLiveVideo\(body\.model_id,renderInput,env\.MUAPI_API_KEY,\{requireLivePostRoute:true\}\)/);
 assert.match(generate,/quoteLiveVideo\(body\.model_id,renderInput,env\.MUAPI_API_KEY,\{requireLivePostRoute:true\}\)/);
 assert.ok(generate.indexOf('requireLivePostRoute:true')<generate.indexOf("phase='wallet-reservation'"));
 const client=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(client,/No se reservaron créditos/);
});
