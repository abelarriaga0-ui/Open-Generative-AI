import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {improveSalesScript,speechWords,voiceBudget} from '../lib/realizo-creative/sales-storyboard.js';
import {buildResearchRequest} from '../lib/realizo-creative/ai-premium.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {acceptsSellerConfirmation} from '../lib/realizo-creative/approval-consent.js';

const description='Shampoo Perfumado NOIL más esencia de perfume con feromonas concentradas, para volverte irresistible, duración y fijación por 24 horas sin perder aroma';
const concept={name:'El aroma de la noche',hook:'¿Quieres destacar esta noche?',
 creative_style:'ugc',angle:'lifestyle',spoken_script:'¿Quieres completar tu rutina? NOIL y GODA. Escribe hoy.',
 video_prompt:'Un creador habla al público con productos',cta:'Pide el combo hoy'};
test('seller-provided product attributes are not automatically softened',()=>{
 const script=improveSalesScript(concept.spoken_script,{
  seconds:15,style:'ugc',productName:'Combo NOIL + GODA',
  description,concept,report:{}});
 assert.match(script,/esencia de perfume con feromonas/);
 assert.match(script,/fijación por 24 horas/);
 assert.doesNotMatch(script,/anunciad[oa]|según vendedor|la marca anuncia|hasta 24/);
 assert.match(script,/Pide el combo hoy/i);
 assert.ok(speechWords(script)>=voiceBudget(15,'ugc').minimum);
});
test('verbatim seller edited speech reaches video prompt without any sanitization of claims',()=>{
 const custom='¿Quieres destacar esta noche? GODA contiene feromonas concentradas, tiene fijación por 24 horas y es un aroma irresistible. NOIL completa tu rutina. ¡Pide el combo!';
 const director=buildCommercialDirectorPackage({concept:{...concept,spoken_script:custom},
  duration:15,style:'ugc',modelId:'seedance-2.5-intl-omni-reference',
  productName:'Combo NOIL + GODA',description});
 assert.equal(director.spoken_script,custom);
 assert.match(director.prompt,/GODA contiene feromonas concentradas, tiene fijación por 24 horas/);
 assert.doesNotMatch(director.prompt,/anunciado como esencia con feromonas/);
});
test('one seller acknowledgment appears at final approval; no claim verification masquerades as proof',()=>{
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(ui,/seller_claims_confirmed:sellerConfirmed/);
 assert.match(ui,/Confirmo que revisé el guion y las afirmaciones comerciales que autorizo/);
 assert.match(ui,/manualSpeechRef.current=true/);
 assert.match(ui,/if\(!manualSpeechRef.current\)setEditedSpeech/);
 assert.match(approval,/acceptsSellerConfirmation\(body\)/);
 assert.match(approval,/seller_claims_confirmation_required/);
 assert.match(approval,/spoken_script:userSpeech/);
});
test('research keeps seller copy and verification as different fields, without extra web or wallet calls',()=>{
 const req=buildResearchRequest({OPENAI_PREMIUM_MODEL:'test',REALIZO_ENV:'sandbox'},{
  signedImage:'https://example.org/product.jpeg',product_name:'Combo NOIL + GODA',
  description,market_code:'EC',creative_style:'ugc',video_duration_seconds:15,
  video_model_id:'seedance-2.5-intl-omni-reference',video_language:'es',sales_angle:'auto'});
 assert.match(req.instructions,/RESPETO DEL TEXTO COMERCIAL/);
 assert.match(req.instructions,/No suprimas palabras como «feromonas» o «24 horas»/);
 assert.equal(req.tool_choice,'required');
 assert.equal(req.max_tool_calls,5);
 assert.equal(req.input[0].content.filter(x=>x.type==='input_image').length,1);
});

test('legacy cached client approves researched concept without new checkbox field; no second billing',()=>{
 assert.equal(acceptsSellerConfirmation({index:0,speech:'Guion vendedor aprobado'}),true);
 assert.equal(acceptsSellerConfirmation({index:0,seller_claims_confirmed:true}),true);
 assert.equal(acceptsSellerConfirmation({index:0,seller_claims_confirmed:false}),false);
 assert.equal(acceptsSellerConfirmation({index:0,seller_claims_confirmed:null}),false);
 assert.equal(acceptsSellerConfirmation(null),false);
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(approval,/if\(!acceptsSellerConfirmation\(body\)\)/);
 assert.match(approval,/requireWalletUser\(request,env\)/);
 assert.match(approval,/seller_claims_confirmation_required/);
 assert.doesNotMatch(approval,/startOpenAIResearch|research_payment_cents/);
});
