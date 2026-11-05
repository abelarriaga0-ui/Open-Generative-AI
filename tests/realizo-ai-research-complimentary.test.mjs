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
test('public research is prepaid per use even if a stale sponsor flag is set',async()=>{
 assert.equal(premiumPublicEnabled(env),true);
 for(const id of ['owner','new-customer','customer-in-any-country']){
  const access=await premiumAccess(env,{id});
  assert.deepEqual(access,{enabled:true,mode:'paid',price_cents:49});
 }
 assert.match(PREMIUM_PRICING_VERSION,/prepaid-usage-unlimited/);
 assert.equal(PREMIUM_PRICE_CENTS,49,'real research price per customer-authorized request');
});
test('production keep_vars does not restore sponsored quota mode',async()=>{
 const {REALIZO_AI_RESEARCH_COMPLIMENTARY:unused,...livePreservedVars}=env;
 const access=await premiumAccess(livePreservedVars,{id:'customer'});
 assert.deepEqual(access,{enabled:true,mode:'paid',price_cents:49});
 // Quoting the research price does not debit any customer until explicit authorization.
 const noFunds={...livePreservedVars,WALLETS_DB:null};
 assert.equal((await premiumAccess(noFunds,{id:'customer-without-balance'})).price_cents,49);
 const cfg=JSON.parse(readFileSync('wrangler.consolidated.jsonc','utf8'));
 assert.equal(cfg.keep_vars,true);
});
test('turning off premium public feature disables new research without affecting video quotes',async()=>{
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
test('client requires explicit confirmed research payment while full paid generation still quotes separately',()=>{
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/Investigación IA/);
 assert.match(ui,/Investigar y pagar USD/);
 assert.match(ui,/const complimentary=config\.billing_mode==='sponsored'&&price===0/);
 assert.match(ui,/if\(!complimentary&&!researchConfirm\)/);
 assert.match(ui,/researchConfirm&&config\?\.billing_mode==='paid'/);
 assert.match(ui,/El video se cobra aparte/);
 const config=JSON.parse(readFileSync('wrangler.consolidated.jsonc','utf8'));
 assert.equal(config.vars.REALIZO_AI_RESEARCH_COMPLIMENTARY,'false');
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

test('funded research has no per-day or 30-day limit; reservation and refund remain atomic',()=>{
 const latest=readFileSync('migrations/0029_realizo_complimentary_research_public.sql','utf8');
 const before=readFileSync('migrations/0020_realizo_paid_research_without_daily_cap.sql','utf8');
 const post=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const access=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 assert.match(latest,/WHEN NEW.billing_type='sponsored'/);
 assert.match(before,/No daily\/30-day cap applies to paid research/);
 assert.match(access,/mode:'paid',price_cents:PREMIUM_PRICE_CENTS/);
 assert.doesNotMatch(access,/mode:'sponsored',price_cents:0/);
 assert.match(post,/await db.batch\(\[ins,reserve\]\)/);
 assert.match(post,/body.max_price_cents!==access.price_cents/);
 assert.match(post,/access.mode==='paid'/);
 const server=readFileSync('app/api/wallet/generate/route.js','utf8');
 assert.match(server,/createReservedJob/);
 assert.match(server,/idempotency_key/);
});
