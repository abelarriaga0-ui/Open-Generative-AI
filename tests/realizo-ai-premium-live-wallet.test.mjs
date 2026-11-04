import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  verifiedRealOwnerBalance, availableAIFunds, PREMIUM_PRICE_CENTS
} from '../lib/realizo-creative/ai-premium.js';

function mockDB({verified=false,available=116,legacy=775}={}){
  const logs=[];
  const db={
    prepare(sql){
      logs.push(sql);
      return {bind(userId){
        return {async first(){
          assert.equal(userId,'account-1');
          if(sql.includes('realizo_muapi_provider_balance_reconciliations r')){
            assert.match(sql,/JOIN realizo_prepaid_muapi_imports i/);
            assert.match(sql,/r\.credited_cents=3000/);
            assert.match(sql,/r\.provider_verified_cents>=3027/);
            assert.match(sql,/i\.amount_cents=775/);
            return verified?{verified:1}:null;
          }
          if(sql.includes('SELECT available_cents AS amount'))
            return {amount:available};
          if(sql.includes('SELECT w.available_cents-COALESCE'))
            return {amount:available-legacy};
          throw Error('unexpected SQL '+sql);
        }};
      }};
    }
  };
  return {db,logs};
}
const production={
 REALIZO_ENV:'production',PAYPAL_MODE:'live',REALIZO_AUTH_PROVIDER:'native',
 REALIZO_AI_PREMIUM_ENABLED:'true',REALIZO_AI_PREMIUM_PUBLIC_ENABLED:'true'
};

test('production: exactly reconciled real owner with $1.16 sees $1.16 research-spendable, rather than $0',async()=>{
 const {db}=mockDB({verified:true,available:116});
 const env={...production,WALLETS_DB:db};
 assert.equal(await verifiedRealOwnerBalance(env,'account-1'),true);
 const spendable=await availableAIFunds(env,'account-1');
 assert.equal(spendable,116);
 assert.ok(spendable>=PREMIUM_PRICE_CENTS);
});
test('sandbox: verified owner and production: verified owner have identical real funds',async()=>{
 const {db}=mockDB({verified:true,available:116});
 for(const REALIZO_ENV of ['production','sandbox']){
  assert.equal(await availableAIFunds({...production,REALIZO_ENV,WALLETS_DB:db},'account-1'),116);
 }
});
test('unreconciled historic import remains excluded from AI purchases',async()=>{
 const {db}=mockDB({verified:false,available:800,legacy:775});
 const env={...production,WALLETS_DB:db};
 assert.equal(await verifiedRealOwnerBalance(env,'account-1'),false);
 assert.equal(await availableAIFunds(env,'account-1'),25);
 assert.ok((await availableAIFunds(env,'account-1'))<PREMIUM_PRICE_CENTS);
});
test('new public customer without historical import keeps their own live wallet funds',async()=>{
 const {db}=mockDB({verified:false,available:116,legacy:0});
 assert.equal(await availableAIFunds({...production,WALLETS_DB:db},'account-1'),116);
});
test('no credit issued when wallet available is below research charge',async()=>{
 const {db}=mockDB({verified:true,available:35});
 assert.equal(await availableAIFunds({...production,WALLETS_DB:db},'account-1'),35);
});
test('the POST live deposit check applies to other users; verified historical owner is the only exception',()=>{
 const route=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 const src=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 const migration=readFileSync('migrations/0021_realizo_sandbox_owner_shared_ai_balance.sql','utf8');
 assert.match(route,/const reconciledRealOwner=await verifiedRealOwnerBalance\(env,user\.id\)/);
 assert.match(route,/if\(!reconciledRealOwner\)/);
 assert.match(route,/payment_provider='paypal' AND status='paid' AND provider_environment='live'/);
 assert.match(route,/await availableAIFunds\(env,user\.id\)<access\.price_cents/);
 assert.match(route,/await db\.batch\(\[ins,reserve\]\)/);
 assert.match(migration,/realizo_ai_paid_reserve/);
 assert.match(migration,/provider_verified_cents>=3027/);
 assert.doesNotMatch(src,/UPDATE wallets SET available_cents/);
 assert.doesNotMatch(route,/UPDATE wallets SET available_cents/);
});
