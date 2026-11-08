import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {premiumVideoOptions} from '../lib/realizo-creative/video-specs.js';
import {validatePremiumInput,premiumBetaEnabled,premiumBetaOwner,
 buildResearchRequest,parseResearchResult,researchSchema,safeResearchResponse} from '../lib/realizo-creative/ai-premium.js';

const selectedVideo=premiumVideoOptions()[0];
const form={
 video_model_id:selectedVideo.id,video_duration_seconds:selectedVideo.durations[0],
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
 const env={...base,WALLETS_DB:{prepare(){return {bind(){return {first:async()=>({verified:1})}}}}}};
 assert.equal(await premiumBetaOwner(env,{id:'owner'}),true);
 assert.equal(await premiumBetaOwner({...env,REALIZO_ENV:'production'},{id:'owner'}),false);
});
test('vision and web research are bounded and never use a Muapi customer balance',()=>{
 const p={...form,id:'00000000-0000-4000-8000-000000000002',product_name:'NOIL',
  market_code:'EC',sales_angle:'premium',signedImage:'https://example.test/signed-image',cta:'Paga al recibir'};
 const request=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-5.5'},p);
 assert.equal(request.max_tool_calls,5);
 assert.equal(request.max_output_tokens,28000);
 assert.equal(buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-5.5'},
   {...p,video_duration_seconds:30}).max_output_tokens,32000);
 assert.equal(request.background,true);
 assert.equal(request.store,true);
 assert.equal(request.reasoning.effort,'high');
 assert.equal(request.tool_choice,'required');
 assert.equal(request.tools[0].search_context_size,'medium');
 assert.equal(request.input[0].content[1].type,'input_image');
 assert.equal(request.input[0].content[1].detail,'high');
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

test('general paid eligibility is strictly live-funded and price fixed at 49 cents',async()=>{
 const {premiumPublicEnabled,premiumAccess,PREMIUM_PRICE_CENTS,availableAIFunds,researchFingerprint}=await import('../lib/realizo-creative/ai-premium.js');
 const env={REALIZO_ENV:'production',PAYPAL_MODE:'live',REALIZO_AUTH_PROVIDER:'native',
  REALIZO_AI_PREMIUM_ENABLED:'true',REALIZO_AI_PREMIUM_PUBLIC_ENABLED:'true',
  REALIZO_AI_RESEARCH_COMPLIMENTARY:'false',
  OPENAI_API_KEY:'private',OPENAI_PREMIUM_MODEL:'gpt-6-luna'};
 assert.equal(premiumPublicEnabled(env),true);
 assert.equal((await premiumAccess(env,{id:'new-user'})).mode,'paid');
 assert.equal(PREMIUM_PRICE_CENTS,49);
 assert.equal(premiumPublicEnabled({...env,PAYPAL_MODE:'sandbox'}),false);
 assert.equal(premiumPublicEnabled({...env,REALIZO_AI_PREMIUM_PUBLIC_ENABLED:'false'}),false);
 const db={prepare(){return {bind(){return {first:async()=>({amount:140})}}}}};
 assert.equal(await availableAIFunds({WALLETS_DB:db},'new-user'),140);
 const id={assetId:'a',productName:'NOIL',description:'x',market:'EC',angle:'auto',audience:'',cta:''};
 assert.equal(await researchFingerprint(id),await researchFingerprint(id));
 assert.notEqual(await researchFingerprint(id),await researchFingerprint({...id,assetId:'b'}));
});

test('real commercial research studies seller-selected adult attraction and storyboard speech-to-image correspondence',()=>{
 const project={...form,product_name:'Goda',description:'Esencia de aroma masculino para una primera impresión sensual entre adultos',
  market_code:'EC',sales_angle:'seduction',creative_style:'ugc',video_duration_seconds:30,
  video_language:'es',signedImage:'https://example.test/private-photo',
  video_model_id:'kling-4.0-reference-to-video',video_workflow_id:'references'};
 const req=buildResearchRequest({OPENAI_PREMIUM_MODEL:'test-research-model'},project);
 assert.match(req.instructions,/ESTUDIO DE CONVERSI[ÓO]N Y DIRECCI[ÓO]N VISUAL/);
 assert.match(req.instructions,/GUION A IMAGEN EN SECUENCIA/);
 assert.match(req.instructions,/consentimiento|consensu|rec[ií]proc/i);
 assert.match(req.instructions,/20–30 s busca 4–6 escenas/);
 assert.match(req.instructions,/sin genitales|actos sexuales expl[ií]citos/i);
 assert.match(req.instructions,/no cambies formato, motor, personas, audio ni duraci[oó]n/i);
 assert.equal(req.tools[0].type,'web_search');
 assert.equal(req.max_tool_calls,5,'no extra paid research stage');
});
test('old paid projects preserve complete researched adult storyboards even if spoken copy needs a free repair',()=>{
 const specific='An adult attends a gathering and exchanges a real, reciprocal, clearly consenting glance with another adult. The real perfume is shown in use when its name is said; no guaranteed attraction.';
 const shots=[
  'Present actor speaks to lens while preparing for social event',
  'Original product is used naturally without altering packaging',
  'Two adults exchange a visible mutual flirtatious glance',
  'They move a little closer with an inviting gesture',
  'Natural conversation with mutual smiles',
  'Return to main actor for spoken purchase CTA'
 ];
 const concept={name:'Aroma y conexión real',creative_style:'ugc',
  buyer_motive:'Atracción adulta y primera impresión sensual',
  spoken_script:'¿Quieres una primera impresión diferente? Conoce Goda. Escríbenos.',
  hook:'¿Quieres una primera impresión diferente?',cta:'Escríbenos para pedirlo.',
  video_prompt:specific,shots};
 const response=safeResearchResponse({
  id:'already-paid-sample',status:'ready',product_name:'Goda',
  description:'Aroma masculino para primera impresión romántica y atraer mujeres adultas',
  market_code:'EC',sales_angle:'auto',creative_style:'ugc',
  video_duration_seconds:30,video_model_id:'kling-4.0-reference-to-video',
  video_language:'es',findings_json:JSON.stringify({product_dossier:{actual_category:'perfume'}}),
  concepts_json:JSON.stringify([concept,{...concept,name:'Otro encuentro'},{...concept,name:'Último encuentro'}])
 });
 assert.equal(response.concepts[0].video_prompt,specific,'never replace researched choreography with a generic perfume scene');
 assert.deepEqual(response.concepts[0].shots,shots,'retain researched and paid scene count');
 assert.equal(response.concepts[0].buyer_motive,concept.buyer_motive,'retain the original emotional purchase motive');
 assert.equal(response.concepts.length,3);
});
