import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMuapiGenerationEnabled } from '../lib/wallet/generation-policy.js';
import {
  PILOT_MODEL_ID,PILOT_ENDPOINT,PILOT_PRICE_CENTS,
  PILOT_OPTIONS,PILOT_INPUT_KEYS,isPilotAccount,isPilotPriceConfigValid,
  getPilotSlotsRemaining,claimPilotSlot,isOwnedSignedProductImage,
} from '../lib/wallet/muapi-pilot.js';
import { signedMediaUrl } from '../lib/realizo-creative/media.js';
import { readFileSync } from 'node:fs';

const user={id:'00000000-0000-4000-8000-000000000001'};
const env={
 REALIZO_ENV:'sandbox',PAYPAL_MODE:'sandbox',
 REALIZO_AUTH_PROVIDER:'native',MUAPI_GENERATION_ENABLED:'true',
 REALIZO_MUAPI_PILOT:'true',REALIZO_MUAPI_PILOT_ACCOUNT_ID:user.id,
 REALIZO_AUTH_ORIGIN:'https://realizo-auth-sandbox.abelarriaga0.workers.dev',
 REALIZO_AUTH_PEPPER:'a'.repeat(64),
};
test('only exact allowlisted owner can activate one real-credits Sandbox job',()=>{
 assert.equal(isMuapiGenerationEnabled(env,user),true);
 assert.equal(isMuapiGenerationEnabled(env,{id:'not-owner'}),false);
 assert.equal(isMuapiGenerationEnabled(env),false);
 assert.equal(isPilotAccount(env,user),true);
 assert.equal(isPilotAccount({...env,REALIZO_MUAPI_PILOT_ACCOUNT_ID:null},user),false);
 assert.equal(isMuapiGenerationEnabled({...env,PAYPAL_MODE:'live'},user),false);
 assert.equal(isMuapiGenerationEnabled({...env,REALIZO_MUAPI_PILOT:'false'},user),false);
 assert.equal(isMuapiGenerationEnabled({...env,MUAPI_GENERATION_ENABLED:'false'},user),false);
});
test('pilot model fixed options and price must exactly match reviewed provider preset',()=>{
 assert.equal(PILOT_MODEL_ID,'wan2.2-image-to-video');
 assert.equal(PILOT_PRICE_CENTS,35);
 const data={
  model_id:PILOT_MODEL_ID,muapi_endpoint:PILOT_ENDPOINT,customer_price_cents:PILOT_PRICE_CENTS,
  allowed_input_keys_json:JSON.stringify(PILOT_INPUT_KEYS),
  fixed_options_json:JSON.stringify(PILOT_OPTIONS),
 };
 assert.equal(isPilotPriceConfigValid(data),true);
 assert.equal(isPilotPriceConfigValid({...data,customer_price_cents:10}),false);
 assert.equal(isPilotPriceConfigValid({...data,fixed_options_json:JSON.stringify({...PILOT_OPTIONS,duration:10})}),false);
 assert.equal(isPilotPriceConfigValid({...data,muapi_endpoint:'other'}),false);
});
test('the one-call quota is consumed once even when clients race',async()=>{
 let claimed=false;
 const db={
   prepare(query){
     return {bind(...args){
       return {run:async()=>{assert.match(query,/INSERT OR IGNORE/);return {meta:{changes:claimed?0:(claimed=true,1)}};},
         first:async()=>claimed?{slot:1}:null};
     },first:async()=>claimed?{slot:1}:null};
   },
 };
 const guarded={...env,WALLETS_DB:db};
 assert.equal(await getPilotSlotsRemaining(guarded,user),1);
 assert.equal(await claimPilotSlot(guarded,user,'job-a'),true);
 assert.equal(await claimPilotSlot(guarded,user,'job-b'),false);
 assert.equal(await getPilotSlotsRemaining(guarded,user),0);
});
test('pilot slot proof works without D1 meta.changes but never authorizes a different job',async()=>{
 let inserted=null;
 const db={prepare(sql){
   if(sql.includes('INSERT OR IGNORE INTO realizo_muapi_pilot_uses')){
     return {bind(jobId,userId){return {run:async()=>{
       if(!inserted)inserted={job_id:jobId,user_id:userId};
       return {meta:{}};
     }}}};
   }
   if(sql.includes('SELECT job_id,user_id FROM realizo_muapi_pilot_uses')){
     return {first:async()=>inserted};
   }
   throw Error('Unexpected SQL');
 }};
 const guarded={...env,WALLETS_DB:db};
 assert.equal(await claimPilotSlot(guarded,user,'first-job'),true);
 assert.equal(await claimPilotSlot(guarded,user,'different-job'),false);
 assert.deepEqual(inserted,{job_id:'first-job',user_id:user.id});
});
test('newly inserted D1 reservation must be recognized by its own UUID even without changes metadata',()=>{
 const source=readFileSync('lib/wallet/server.js','utf8');
 assert.match(source,/newlyCreated:\s*raceWinner\.id\s*===\s*jobId/);
 assert.match(source,/!job\.newlyCreated|return \{ \.\.\.previous, newlyCreated: false \}/);
});
test('only owner can reference nonexpired correctly signed private input image',async()=>{
 const id='00000000-0000-4000-8000-000000000002';
 const expires=Math.floor(Date.now()/1000)+1200;
 const url=await signedMediaUrl(env,id,expires);
 const db={prepare(query){return {bind(...args){return {first:async()=>args[1]===user.id?{id}:null}}}}};
 const guarded={...env,WALLETS_DB:db};
 assert.equal(await isOwnedSignedProductImage(guarded,user,url),true);
 assert.equal(await isOwnedSignedProductImage(guarded,{id:'someone-else'},url),false);
 assert.equal(await isOwnedSignedProductImage(guarded,user,url.replace('sig=','sig=0')),false);
 assert.equal(await isOwnedSignedProductImage(guarded,user,'https://evil.example/image'),false);
});
test('pilot is disabled for everyone until the private worker secret is installed',()=>{
 const conf=JSON.parse(readFileSync('wrangler.auth-sandbox.jsonc','utf8'));
 assert.equal(conf.vars.REALIZO_MUAPI_PILOT_ACCOUNT_ID,undefined);
 assert.equal(conf.vars.MUAPI_API_KEY,undefined);
 assert.equal(isMuapiGenerationEnabled(conf.vars,user),false);
 assert.equal(conf.vars.PAYPAL_MODE,'sandbox');
});
