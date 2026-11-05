import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {verifyPremiumGeneration} from '../lib/realizo-creative/premium-generation-gate.js';

const id='f04c5736-4a28-4895-8bd6-9b7cd8773e42';
const model='gemini-omni-image-to-video';
const adversarial={
  name:'Caspa: problema y solución',angle:'problem',creative_style:'ugc',
  hook:'Mujer triste se mira al espejo',
  video_prompt:'Woman in bathroom touches hair, applies shampoo, shows miraculous results. She speaks to camera like a creator.',
  spoken_script:'Tenía caspa y ahora mi pelo luce hermoso, cómpralo',
  shots:['Woman showing face','Shampoo with a human hand','Before and after actress'],
  cta:'Pruébalo ahora',
};
const make=(castMode='product_only',shotPreference='multi')=>buildCommercialDirectorPackage({
 concept:adversarial, productName:'Nipori Champú',description:'Champú capilar, botella azul con tapa roja',
 modelId:model,workflowId:'references',style:'premium',castMode,
 duration:8,shotPreference,productGeometry:null,imageProvided:true,
});
const mockProject=(prompt,cast_mode='product_only')=>({
 id,status:'approved',creative_style:'premium',cast_mode,audio_mode:'no_voice',approved_prompt:prompt,
 video_model_id:model,video_duration_seconds:8,
});
function dbFor(project){return {prepare:()=>({bind:()=>({first:async()=>project})})};}
test('Premium Solo producto ignores researched UGC problem-solution, female actor and selfie scenes',()=>{
 const p=make();
 assert.equal(p.cast_mode,'product_only');
 assert.equal(p.shot_count,3);
 assert.match(p.prompt,/REALIZO LUXURY FILM CONTRACT v2/);
 assert.match(p.prompt,/ABSOLUTE PRODUCT-ONLY CAST LOCK/);
 assert.match(p.prompt,/ZERO HUMAN PIXELS/);
 assert.match(p.prompt,/macro|close-focus/);
 assert.match(p.prompt,/PRODUCT-ONLY EDITORIAL TIMELINE/);
 assert.doesNotMatch(p.prompt,/Woman in bathroom|Mujer triste|miraculous results|human hand|NMF SALES STORY|Buyer recognizes friction|SPOKEN SCRIPT|RESEARCHED SHOT IDEAS|natural skin, face/);
 assert.ok(p.prompt.length<=12500);
});
test('Premium with actors is a cinematic brand film, never UGC',()=>{
 const p=make('with_people');
 assert.match(p.prompt,/PROFESSIONAL CINEMA COMMERCIAL, NOT UGC/);
 assert.match(p.prompt,/Professionally styled adult models/);
 assert.match(p.prompt,/LUXURY BRAND FILM TIMELINE/);
 assert.doesNotMatch(p.prompt,/Woman in bathroom|SPOKEN SCRIPT|NMF SALES STORY/);
});
test('single shot means a physically continuous take and NO cuts',()=>{
 const p=make('product_only','single');
 assert.equal(p.shot_count,1);
 assert.match(p.prompt,/SINGLE UNBROKEN SHOT/);
 assert.doesNotMatch(p.prompt,/PRODUCT-ONLY EDITORIAL TIMELINE/);
});
test('server gate accepts exact approved cinematic film and rejects old ad before reservation',async()=>{
 const approved=make().prompt;
 const context={project_id:id,creative_style:'premium',cast_mode:'product_only',audio_mode:'no_voice'};
 const input={prompt:approved,duration:8};
 assert.equal(await verifyPremiumGeneration(dbFor(mockProject(approved)),id,model,input,context),null);
 assert.equal(await verifyPremiumGeneration(dbFor(mockProject(approved)),id,model,{...input,prompt:'Mujer se toca el cabello. Producto como solución.'},context),'premium_brief_reapproval_required');
 assert.equal(await verifyPremiumGeneration(dbFor(mockProject(approved)),id,model,input,{...context,cast_mode:'with_people'}),'premium_brief_reapproval_required');
 assert.equal(await verifyPremiumGeneration(dbFor(mockProject(approved)),id,'other-model',input,context),'premium_brief_reapproval_required');
 assert.equal(await verifyPremiumGeneration(dbFor(mockProject(approved)),id,model,{...input,duration:12},context),'premium_brief_reapproval_required');
 assert.equal(await verifyPremiumGeneration(dbFor(mockProject(approved.replace('ZERO HUMAN PIXELS','MODEL PIXELS'))),id,model,
  {...input,prompt:approved.replace('ZERO HUMAN PIXELS','MODEL PIXELS')},context),'premium_cast_contract_missing');
});
test('client sends cast context in quote and generate, server checks it before calling provider or reserving',()=>{
 const client=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 const studio=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 const q=readFileSync('app/api/wallet/quote/route.js','utf8');
 const g=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(studio,/creativeContext:preparedBrief\?\.project_id/);
 assert.match(studio,/cast_mode:preparedBrief.cast_mode/);
 assert.match(client,/creative_context:creativeContext/);
 assert.match(q,/verifyPremiumGeneration/);
 assert.match(g,/verifyPremiumGeneration/);
 assert.ok(g.indexOf('const premiumError=await verifyPremiumGeneration')<g.indexOf("phase='wallet-reservation'"));
});


test('Goda Premium voiceover preserves full audio contract when approved and sent to quote',async()=>{
 const voice=buildCommercialDirectorPackage({
  concept:adversarial,productName:'Goda',
  description:'Esencia de perfume concentrada para uso personal',
  modelId:model,workflowId:'references',style:'premium',
  castMode:'with_people',audioMode:'voiceover',duration:8,imageProvided:true,
 });
 const approved=voice.prompt;
 assert.match(approved,/REALIZO LUXURY FILM CONTRACT v2/);
 assert.match(approved,/AUDIO VOICEOVER/);
 assert.match(approved,/MANDATORY NARRATION MODE/);
 assert.ok(approved.length>5500,'Old 5,500-char approval cap would lose part of the film contract');
 const context={project_id:id,creative_style:'premium',cast_mode:'with_people',audio_mode:'voiceover'};
 const project={...mockProject(approved,'with_people'),audio_mode:'voiceover'};
 assert.equal(await verifyPremiumGeneration(dbFor(project),id,model,{prompt:approved,duration:8},context),null);
 assert.notEqual(approved.slice(0,5500),approved,'Do not truncate original approved direction');
});
test('approval and client editor keep the exact server-built Premium film prompt',()=>{
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const studio=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(approval,/const finalPrompt=director\.prompt;/);
 assert.doesNotMatch(approval,/finalPrompt=director\.prompt\.slice/);
 assert.match(studio,/setPrompt\(String\(preparedBrief\.prompt\|\|""\)\)/);
 assert.match(studio,/!\['premium','cinematic'\]\.includes\(preparedBrief\.creative_style\)/);
});
