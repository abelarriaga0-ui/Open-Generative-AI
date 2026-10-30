import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validatePremiumInput,premiumBetaEnabled,premiumBetaOwner,
 buildResearchRequest,parseResearchResult,researchSchema} from '../lib/realizo-creative/ai-premium.js';

const form={
 product_name:'NOIL',description:'Gel de ducha perfumado masculino',
 primary_asset_id:'00000000-0000-4000-8000-000000000001',request_key:'testrequest123',
 market:'EC',angle:'premium',
};
test('only valid, user-owned product details can start a project',()=>{
 const v=validatePremiumInput(form);assert.equal(v.market,'EC');
 assert.equal(v.angle,'premium');
 assert.throws(()=>validatePremiumInput({...form,market:'INVALID'}),/invalid_request/);
 assert.throws(()=>validatePremiumInput({...form,primary_asset_id:'bad'}),/invalid_request/);
 assert.throws(()=>validatePremiumInput({...form,description:'too short'}),/invalid_request/);
});
test('premium stays disabled without explicit sandbox approval and a protected OpenAI key',async()=>{
 const base={REALIZO_ENV:'sandbox',REALIZO_AUTH_PROVIDER:'native',PAYPAL_MODE:'sandbox',
  REALIZO_AI_PREMIUM_ENABLED:'true',OPENAI_API_KEY:'private',OPENAI_PREMIUM_MODEL:'gpt-5.5'};
 assert.equal(premiumBetaEnabled(base),true);
 assert.equal(premiumBetaEnabled({...base,REALIZO_AI_PREMIUM_ENABLED:'false'}),false);
 assert.equal(premiumBetaEnabled({...base,OPENAI_API_KEY:''}),false);
 assert.equal(premiumBetaEnabled({...base,REALIZO_ENV:'production'}),false);
 const env={...base,WALLETS_DB:{prepare(){return {bind(){return {first:async()=>({user_id:'owner'})}}}}}};
 assert.equal(await premiumBetaOwner(env,{id:'owner'}),true);
 assert.equal(await premiumBetaOwner({...env,REALIZO_ENV:'production'},{id:'owner'}),false);
});
test('vision and web research are bounded and never use a Muapi customer balance',()=>{
 const p={...form,id:'00000000-0000-4000-8000-000000000002',product_name:'NOIL',
  market_code:'EC',sales_angle:'premium',signedImage:'https://example.test/signed-image',cta:'Paga al recibir'};
 const request=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-5.5'},p);
 assert.equal(request.max_tool_calls,3);
 assert.ok(request.max_output_tokens<=3100);
 assert.equal(request.background,true);
 assert.equal(request.store,true);
 assert.equal(request.input[0].content[1].type,'input_image');
 assert.equal(request.tools[0].type,'web_search');
 assert.equal(request.text.format.strict,true);
 assert.equal(request.text.format.schema.required.length,Object.keys(researchSchema().properties).length);
 assert.ok(!JSON.stringify(request).includes('MUAPI_API_KEY'));
});
test('report yields exactly three concepts and only tool-provided verified sources',()=>{
 const template={name:'Premium',angle:'premium',reason:'Desire',
   hook:'Aroma',script:'Use safely',video_prompt:'An elegant blue bottle with natural light',
   cta:'Paga al recibir',shots:['Hero','Detail'],restrictions:['Do not change the label']};
 const report={product_observation:'Blue bottle',description_conflicts:['The label says shampoo'],
  verified_claims:[],claims_to_verify:['Aroma 24 hours'],market_summary:'Market needs more evidence',
  audience_insights:['Adults'],research_limitations:['No Meta analytics'],
  recommended_index:0,concepts:[template,{...template,name:'Sensory'},{...template,name:'Direct'}]};
 const response={status:'completed',output:[
   {type:'web_search_call',action:{sources:[{url:'https://example.org/source',title:'Public source'}]}},
   {type:'message',content:[{type:'output_text',text:JSON.stringify(report),
      annotations:[{type:'url_citation',url:'https://example.org/other',title:'Other source'}]}]},
 ]};
 const result=parseResearchResult(response);
 assert.equal(result.report.concepts.length,3);
 assert.equal(result.sources.length,2);
 assert.throws(()=>parseResearchResult({...response,status:'in_progress'}),/research_not_completed/);
 assert.throws(()=>parseResearchResult({...response,output:[{type:'message',
   content:[{type:'output_text',text:JSON.stringify({...report,concepts:[template]})}]}]}),/research_invalid_content/);
});
test('native route guard keeps Premium API private and the UI exposes all three creation modes',async()=>{
 const {walletPilotAction}=await import('../lib/wallet/request-policy.js');
 assert.equal(walletPilotAction('/api/realizo/ai-premium',true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/ai-premium/123/approve',true,true),'allow');
 assert.equal(walletPilotAction('/api/realizo/ai-premium',true,false),'deny');
 const studio=readFileSync('components/RealizoStudio.jsx','utf8');
 assert.match(studio,/RealizoPremium/);
 for(const option of ['automatic','manual','premium'])assert.ok(studio.includes("'"+option+"'"));
 const schema=readFileSync('migrations/0012_realizo_ai_premium.sql','utf8');
 assert.doesNotMatch(schema,/UPDATE wallets|INSERT INTO wallet_ledger/);
});
