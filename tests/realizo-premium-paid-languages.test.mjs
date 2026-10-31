import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premiumAccess,premiumSandboxPaidOwner,validatePremiumInput,
 buildResearchRequest,researchFingerprint,PREMIUM_PRICE_CENTS} from '../lib/realizo-creative/ai-premium.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
const env={REALIZO_ENV:'sandbox',REALIZO_AUTH_PROVIDER:'native',PAYPAL_MODE:'sandbox',
 REALIZO_AI_PREMIUM_ENABLED:'true',OPENAI_API_KEY:'k',OPENAI_PREMIUM_MODEL:'gpt-6-luna'};
test('Verified sandbox owner gets PAID $0.49, never sponsored or fictional PayPal funds',async()=>{
 const E={...env,WALLETS_DB:{prepare(sql){return {bind(id){return {first:async()=>sql.includes('realizo_prepaid_muapi_imports')?
  {user_id:'owner'}:sql.includes('realizo_muapi_provider_balance_reconciliations')?
  {user_id:'owner'}:null}}}}}};
 assert.equal(await premiumSandboxPaidOwner(E,{id:'owner'}),true);
 const access=await premiumAccess(E,{id:'owner'});
 assert.equal(access.mode,'paid');assert.equal(access.price_cents,49);
 assert.equal(PREMIUM_PRICE_CENTS,49);
 const noRec={...E,WALLETS_DB:{prepare(sql){return {bind(){return {first:async()=>sql.includes('realizo_prepaid_muapi_imports')?{user_id:'owner'}:null}}}}}};
 assert.equal((await premiumAccess(noRec,{id:'owner'})).enabled,false);
});
test('Video speech locale validated and included in the paid research fingerprint',async()=>{
 const form={description:'Perfume masculino en gotero',market:'EC',angle:'auto',
 primary_asset_id:'00000000-0000-4000-8000-000000000001',request_key:'0123456789abcdef'};
 for(const lang of ['es','en','pt','fr','de','it'])assert.equal(validatePremiumInput({...form,video_language:lang}).videoLanguage,lang);
 assert.throws(()=>validatePremiumInput({...form,video_language:'invalid'}),/invalid_request/);
 const one={assetId:form.primary_asset_id,description:form.description,market:'EC',videoLanguage:'es'};
 assert.notEqual(await researchFingerprint(one),await researchFingerprint({...one,videoLanguage:'en'}));
});
test('Multilingual speech is explicit despite English camera instructions',()=>{
 for(const [code,name] of [['es','Spanish'],['en','English'],['pt','Portuguese'],['fr','French'],['de','German'],['it','Italian']]){
  const concept={name:'UGC',angle:'ugc',spoken_script:'Message from research',hook:'Hook',video_prompt:'Sell with actor',shots:['Actor','Product']};
  const x=buildCommercialDirectorPackage({concept,productName:'Goda',description:'Perfume de hombre',videoLanguage:code,market:'EC',modelId:'seedance-2.5-omni-reference'});
  assert.match(x.prompt,new RegExp('MANDATORY AUDIO LANGUAGE: '+name));
  assert.equal(x.video_language,code);
 }
});
test('User interface shows exact price and illustrated concepts and hides lengthy technical research',()=>{
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.doesNotMatch(ui,/Investigación patrocinada · video aparte|Comenzar sin cargo de investigación/);
 assert.match(ui,/window\.confirm\(message\)/);
 assert.match(ui,/config\.customer_charge_cents/);
 assert.match(ui,/Idioma de voz y video/);
 assert.match(ui,/visualFor\(c\)/);
 assert.match(ui,/Ver informe completo, verificaciones y fuentes/);
 assert.match(ui,/Editar prompt técnico \(avanzado\)/);
 assert.equal(ui.split('PROYECTO PREMIUM').length-1,1);
 const api=readFileSync('app/api/realizo/ai-premium/route.js','utf8');
 assert.match(api,/premiumSandboxPaidOwner/);
 assert.match(api,/data\.videoLanguage/);
 assert.match(api,/general_available_cents/);
});
