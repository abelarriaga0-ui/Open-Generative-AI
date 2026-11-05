import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyMuapiTaskFailure,safeStoredMuapiFailureCode,PUBLIC_MUAPI_FAILURE_CODES} from '../lib/wallet/muapi-task-failure.js';

test('Muapi result failures distinguish known categories without returning untrusted messages',()=>{
 const cases=[
  [{status:'failed',error:{code:'MODERATION_BLOCKED',message:'safety issue'}},'generation_content_rejected'],
  [{status:'failed',data:{error:{reason:'image url expired; reference cannot download'}}},'generation_image_reference_invalid'],
  [{status:'failed',detail:{message:'prompt too long for this model'}},'generation_prompt_invalid'],
  [{status:'failed',failure_reason:'invalid duration'},'generation_duration_invalid'],
  [{status:'failed',error:{message:'unsupported resolution 720p'}},'generation_quality_invalid'],
  [{status:'failed',error:{code:'RATE_LIMIT',message:'too many requests'}},'generation_service_busy'],
  [{status:'failed',data:{error:{message:'insufficient provider balance'}}},'generation_service_balance_unavailable'],
  [{status:'failed',reason:'model unavailable'},'generation_model_unavailable'],
  [{status:'failed',detail:'inference timed out'},'generation_service_unavailable'],
  [{status:'failed',error:'not disclosed'},'provider_failed']
 ];
 for(const [response,expected] of cases){
  assert.equal(classifyMuapiTaskFailure(response),expected);
  assert.ok(PUBLIC_MUAPI_FAILURE_CODES.includes(expected));
 }
 assert.equal(safeStoredMuapiFailureCode('https://evil.test/private?api_key=secret'),'provider_failed');
 assert.equal(safeStoredMuapiFailureCode('generation_prompt_invalid'),'generation_prompt_invalid');
});
test('funded research has no artificial count cap but still needs verified credits',()=>{
 const premium=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 const sql=readFileSync('migrations/0029_realizo_complimentary_research_public.sql','utf8');
 const api=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const wrangler=JSON.parse(readFileSync('wrangler.consolidated.jsonc','utf8'));
 assert.match(premium,/mode:'paid',price_cents:PREMIUM_PRICE_CENTS/);
 assert.doesNotMatch(premium,/mode:'sponsored',price_cents:0/);
 assert.match(sql,/WHEN NEW.billing_type='sponsored'/);
 assert.equal(wrangler.vars.REALIZO_AI_RESEARCH_COMPLIMENTARY,'false');
 assert.match(api,/await availableAIFunds\(env,user\.id\)<access\.price_cents/);
 assert.match(api,/body.max_price_cents!==access.price_cents/);
 assert.match(api,/await db.batch\(\[ins,reserve\]\)/);
 const videos=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(videos,/createReservedJob/);
 assert.doesNotMatch(videos,/daily_generation_limit|MAX_GENERATIONS_PER_DAY/);
});
test('failed free/editor videos show persistent details, with wallet release verified by ledger',()=>{
 const job=readFileSync('app/api/wallet/jobs/[id]/route.js','utf8');
 const video=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 const wallet=readFileSync('lib/realizo-creative/wallet-generation.js','utf8');
 assert.match(job,/classifyMuapiTaskFailure/);
 assert.match(job,/safeStoredMuapiFailureCode/);
 assert.match(job,/release_confirmed/);
 assert.match(job,/wallet_ledger/);
 assert.match(wallet,/status\.failure_code/);
 assert.match(video,/setGenerateError\(errMsg\)/);
 assert.match(video,/generateError&&<section role="alert"/);
 assert.doesNotMatch(video,/toast\.error\(errMsg\)/);
});
