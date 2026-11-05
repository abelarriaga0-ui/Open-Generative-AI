import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  premiumAccess,premiumPublicEnabled,PREMIUM_PRICE_CENTS,
  PREMIUM_PRICING_VERSION,verifiedRealOwnerBalance,safeResearchResponse
} from '../lib/realizo-creative/ai-premium.js';

const env={
 REALIZO_ENV:'production',PAYPAL_MODE:'live',REALIZO_AUTH_PROVIDER:'native',
 REALIZO_AI_PREMIUM_ENABLED:'true',REALIZO_AI_PREMIUM_PUBLIC_ENABLED:'true',
 REALIZO_AI_RESEARCH_COMPLIMENTARY:'true',
 OPENAI_API_KEY:'protected-openai-key',OPENAI_PREMIUM_MODEL:'gpt-6-luna'
};
test('research is truly zero price for any authenticated customer, not merely labelled free',async()=>{
 assert.equal(premiumPublicEnabled(env),true);
 for(const id of ['owner','new-customer','customer-in-any-country']){
  const access=await premiumAccess(env,{id});
  assert.deepEqual(access,{enabled:true,mode:'sponsored',price_cents:0});
 }
 assert.match(PREMIUM_PRICING_VERSION,/complimentary/);
 assert.equal(PREMIUM_PRICE_CENTS,49,'original price remains configurable for later');
});
test('production keep_vars cannot silently re-enable a 49-cent charge when new flag is absent',async()=>{
 const {REALIZO_AI_RESEARCH_COMPLIMENTARY:unused,...livePreservedVars}=env;
 const access=await premiumAccess(livePreservedVars,{id:'customer'});
 assert.deepEqual(access,{enabled:true,mode:'sponsored',price_cents:0});
 // A customer's wallet balance must never determine free-research eligibility.
 const noFunds={...livePreservedVars,WALLETS_DB:null};
 assert.equal((await premiumAccess(noFunds,{id:'customer-without-balance'})).price_cents,0);
 const cfg=JSON.parse(readFileSync('wrangler.consolidated.jsonc','utf8'));
 assert.equal(cfg.keep_vars,true);
});
test('switching off promotion restores verified paid research without altering video quote',async()=>{
 assert.equal((await premiumAccess({...env,REALIZO_AI_RESEARCH_COMPLIMENTARY:'false'},{id:'owner'})).mode,'paid');
 assert.equal((await premiumAccess({...env,REALIZO_AI_RESEARCH_COMPLIMENTARY:'false'},{id:'owner'})).price_cents,49);
 assert.equal((await premiumAccess({...env,REALIZO_AI_PREMIUM_ENABLED:'false'},{id:'owner'})).enabled,false);
});
test('free project is explicitly marked complimentary without altering archived paid projects',()=>{
 const item={id:'project',user_id:'owner',status:'ready',product_name:'GODA',
  video_language:'es',creative_style:'ugc',video_duration_seconds:8,
  concepts_json:null,findings_json:null,sources_json:null,selected_concept:null};
 assert.equal(safeResearchResponse({...item,billing_type:'sponsored'}).research_is_complimentary,true);
 assert.equal(safeResearchResponse({...item,billing_type:'paid'}).research_is_complimentary,false);
});
test('server skips every wallet debit and payment check in sponsored mode, but preserves those when paid',()=>{
 const api=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const poll=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
 assert.match(api,/if\(access\.mode==='paid'\)/);
 assert.match(api,/else await ins\.run\(\)/);
 assert.match(api,/access\.price_cents/);
 assert.match(api,/pricing_version/);
 assert.match(api,/mode==='sponsored'/);
 assert.match(poll,/if\(project\.billing_type==='paid'\)/);
 assert.doesNotMatch(api,/UPDATE wallets SET/);
});
test('client shows Gratis por ahora, can start for zero without payment confirmation or deposit',()=>{
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/Gratis por ahora/);
 assert.match(ui,/Investigar gratis/);
 assert.match(ui,/const complimentary=config\.billing_mode==='sponsored'&&price===0/);
 assert.match(ui,/if\(!complimentary&&!researchConfirm\)/);
 assert.match(ui,/researchConfirm&&config\?\.billing_mode==='paid'/);
 assert.match(ui,/El video se cobra aparte/);
 const config=JSON.parse(readFileSync('wrangler.consolidated.jsonc','utf8'));
 assert.equal(config.vars.REALIZO_AI_RESEARCH_COMPLIMENTARY,'true');
 assert.equal(config.vars.MUAPI_GENERATION_ENABLED,'true');
 assert.equal(config.vars.PAYPAL_MODE,'live');
});
test('verified owner identity depends on user_id and the provider reconciliation, not 7.75 legacy import',async()=>{
 const db={
  prepare(sql){
   assert.match(sql,/WHERE r\.slot=1 AND r\.user_id=\?/);
   assert.doesNotMatch(sql,/amount_cents=775|JOIN realizo_prepaid_muapi_imports/);
   return {bind(value){assert.equal(value,'owner');return {first:async()=>({verified:1})}}};
  }
 };
 assert.equal(await verifiedRealOwnerBalance({...env,WALLETS_DB:db},'owner'),true);
 const migration=readFileSync('migrations/0029_realizo_complimentary_research_public.sql','utf8');
 assert.match(migration,/NEW\.billing_type='sponsored'/);
 assert.match(migration,/user_id=NEW\.user_id/);
 assert.doesNotMatch(migration,/amount_cents=775/);
 assert.match(migration,/premium_price_cents=NEW\.price_cents/);
});
