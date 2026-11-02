import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeLiveVideoInput,quoteLiveVideo} from '../lib/wallet/live-video-models.js';

const model='gemini-omni-image-to-video';
const photo='https://example.org/catalog/product.png';
const legacy={prompt:'Cinematic product commercial',images_list:[photo],
 duration:8,aspect_ratio:'9:16',resolution:'720p'};
const originalFetch=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=originalFetch});
test('Gemini Omni canonicalizes legacy image lists to documented image_urls',()=>{
 assert.deepEqual(normalizeLiveVideoInput(model,legacy),
  {prompt:legacy.prompt,image_urls:[photo],duration:8,aspect_ratio:'9:16',resolution:'720p'});
 assert.equal('images_list' in legacy,true);
 assert.deepEqual(normalizeLiveVideoInput(model,{...legacy,images_list:undefined,image_url:photo}).image_urls,[photo]);
});
test('the documented image field is retained and unsupported fields fail BEFORE billing',()=>{
 const normal={prompt:legacy.prompt,image_urls:[photo],resolution:'720p',duration:8};
 assert.deepEqual(normalizeLiveVideoInput(model,normal),normal);
 assert.throws(()=>normalizeLiveVideoInput(model,{...legacy,quality:'ultra'}),/model_input_fields_unsupported/);
 assert.throws(()=>normalizeLiveVideoInput(model,{...legacy,image_url:photo}),/model_reference_fields_conflict/);
 assert.throws(()=>normalizeLiveVideoInput(model,{prompt:'Cinematic'}),/model_reference_images_required/);
 assert.throws(()=>normalizeLiveVideoInput(model,{prompt:'Cinematic',image_url:'http://insecure.test/i.png'}),/model_reference_images_invalid/);
});
test('never turn a reference into first-frame animation or silently change endpoints',()=>{
 assert.equal(normalizeLiveVideoInput('gemini-omni-flash-1-1-image-to-video',legacy),legacy);
 const result=normalizeLiveVideoInput('gemini-omni-flash-1-1-reference-to-video',legacy);
 assert.deepEqual(result.image_urls,[photo]);
 assert.equal('first_frame_url' in result,false);
});
test('estimate endpoint receives canonical media keys for Gemini Omni',async()=>{
 let calls=0;
 globalThis.fetch=async(url,opts={})=>{
  calls++;
  if(String(url).endsWith('/estimate-cost')){
   const input=JSON.parse(opts.body);
   assert.deepEqual(input,normalizeLiveVideoInput(model,legacy));
   assert.equal(opts.headers['x-api-key'],undefined);
   return {ok:true,status:200,json:async()=>({cost:1.04,currency:'USD'})};
  }
  return {ok:true,status:200,json:async()=>({
   name:model,category:'Image to Video',dynamic_pricing:true,
   endpoint:'/api/v1/'+model,
   estimate_endpoint:'/api/v1/models/'+model+'/estimate-cost',
   cost_currency:'USD'
  })};
 };
 const quote=await quoteLiveVideo(model,legacy);
 assert.equal(quote.endpoint,model);
 assert.equal(quote.provider_cost_cents,104);
 assert.equal(calls,2);
});
test('the generation route uses identical normalization before the provider request',()=>{
 const generate=readFileSync('app/api/wallet/generate/route.js','utf8');
 const quote=readFileSync('lib/wallet/live-video-models.js','utf8');
 const studio=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(quote,/input=normalizeLiveVideoInput\(modelId,input\)/);
 assert.match(generate,/pricedInput=normalizeLiveVideoInput\(body.model_id,\{\.\.\.body.input,\.\.\.fixed\}\)/);
 assert.match(generate,/body: JSON.stringify\(pricedInput\)/);
 assert.match(studio,/castMode:preparedBrief.cast_mode/);
});
