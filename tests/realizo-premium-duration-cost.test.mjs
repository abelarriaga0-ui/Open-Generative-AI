import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premiumVideoOptions,resolvePremiumVideoChoice} from '../lib/realizo-creative/video-specs.js';
import {validatePremiumInput,buildResearchRequest,researchFingerprint} from '../lib/realizo-creative/ai-premium.js';
import {estimateOpenAIResearchCost} from '../lib/realizo-creative/openai-costs.js';

const models=premiumVideoOptions();
const pick=models.find(v=>v.durations.includes(15))||models[0];
test('model and duration choices come from the real video catalog, without billable AI',()=>{
 assert.ok(models.length>0);
 assert.ok(pick.durations.length>0);
 assert.ok(['product_reference','start_frame','none'].includes(pick.image_role));
 assert.equal(resolvePremiumVideoChoice(pick.id,pick.durations[0]).modelId,pick.id);
 assert.throws(()=>resolvePremiumVideoChoice(pick.id,999),/invalid_video_configuration/);
 assert.throws(()=>resolvePremiumVideoChoice('fabricated-provider',8),/invalid_video_configuration/);
});
test('research prompt is created ONCE for selected model, duration and language',()=>{
 const selected=pick.durations.at(-1);
 const data=validatePremiumInput({
  description:'Fragancia para caballeros con aroma fresco',
  primary_asset_id:'00000000-0000-4000-8000-000000000001',
  request_key:'request000000000001',market:'EC',angle:'auto',
  video_language:'es',video_model_id:pick.id,video_duration_seconds:selected,
 });
 assert.equal(data.duration,selected);
 const prompt=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},{
  product_name:'Goda',description:'Perfume de hombre',market_code:'EC',
  sales_angle:'auto',video_language:'es',video_model_id:pick.id,
  video_duration_seconds:selected,video_workflow_id:pick.workflow_id,
  signedImage:'https://example.test/product.jpg',id:'project-id',
 });
 assert.match(prompt.instructions,new RegExp('Duración OBLIGATORIA: '+selected+' s'));
 assert.ok(prompt.instructions.includes(pick.id));
 assert.doesNotMatch(prompt.instructions,/7-8 segundos|maximo 17 palabras|7-8 s por defecto/i);
 assert.equal(prompt.max_tool_calls,5);
 assert.equal(prompt.tools[0].type,'web_search');
});
test('fingerprint changes with model/duration to prevent reusing a wrong paid script',async()=>{
 const base={assetId:'image',description:'Producto',market:'EC',modelId:pick.id,duration:pick.durations[0]};
 assert.notEqual(await researchFingerprint(base),await researchFingerprint({...base,duration:99}));
 assert.notEqual(await researchFingerprint(base),await researchFingerprint({...base,modelId:'other'}));
});
test('provider usage estimate is clearly not an exact OpenAI invoice',()=>{
 const e=estimateOpenAIResearchCost({model:'gpt-6-luna',usage:{
  input_tokens:5000,input_tokens_details:{cached_tokens:1000},output_tokens:1000,
 },webCalls:2});
 assert.equal(e.status,'estimated');
 assert.equal(e.microUsd,20455);
 assert.equal(estimateOpenAIResearchCost({model:'unpriced',usage:{input_tokens:100},webCalls:0}).status,'unavailable');
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/costo de OpenAI/i);
 assert.match(ui,/NO factura final/);
});
test('fixed existing billing does not become an unapproved variable charge',()=>{
 const mig=readFileSync('migrations/0018_realizo_premium_video_choice_cost_audit.sql','utf8');
 const api=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(mig,/video_model_id/);
 assert.match(mig,/video_duration_seconds/);
 assert.match(mig,/estimated_cost_micro_usd/);
 assert.match(api,/data.modelId,data.duration,data.workflowId/);
 assert.match(approval,/resolvePremiumVideoChoice\(modelId,body.video_duration_seconds\?\?project.video_duration_seconds\)/);
 assert.match(approval,/video_duration_seconds=\?/);
 assert.match(editor,/preparedBrief.video_duration_seconds/);
 assert.doesNotMatch(approval,/duration:8/);
});
