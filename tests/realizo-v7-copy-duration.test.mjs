import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {improveSalesScript,voiceBudget,speechWords,scriptReadiness} from '../lib/realizo-creative/sales-storyboard.js';
import {safeResearchResponse,buildResearchRequest} from '../lib/realizo-creative/ai-premium.js';
const seller='Shampoo Perfumado Noil mas esencia de perfume con feromonas concentradas, para volverte irresistible y que las mujeres no quieran separarse de ti toda la noche, duración y fijación por 24 horas sin perder aroma';
const concept={
 name:'Dos pasos, sin promesas mágicas',creative_style:'ugc',
 hook:'¿Te arreglas para salir y quieres tener clara tu rutina?',
 spoken_script:'¿Te arreglas para salir y quieres tener clara tu rutina noil para el cabello y Goda para el aroma. Escríbeme para consultar disponibilidad y detalles.',
 cta:'Escríbeme para consultar disponibilidad',angle:'lifestyle',
 video_prompt:'UGC creador hombre muestra el combo con voz continua',
};
test('15-second UGC respects the owner description, uses buyer desire and fills the runtime',()=>{
 const speech=improveSalesScript(concept.spoken_script,{
  seconds:15,style:'ugc',productName:'Combo NOIL + GODA',
  description:seller,concept,report:{},
 });
 const budget=voiceBudget(15,'ugc');
 assert.ok(speechWords(speech)>=budget.minimum,speech);
 assert.ok(speechWords(speech)<=budget.maximum,speech);
 assert.match(speech,/salir|aroma destaque/i);
 assert.match(speech,/NOIL/i);
 assert.match(speech,/GODA/i);
 assert.match(speech,/feromonas/i);
 assert.match(speech,/24 horas/i);
 assert.match(speech,/esencia de perfume con feromonas/i);
 assert.match(speech,/combo hoy/i);
 assert.doesNotMatch(speech,/las mujeres no quieran|irresistible|garantiza/i);
 assert.equal(scriptReadiness(speech,{seconds:15,style:'ugc'}).tooShort,false);
});
test('changing from 12 to 15 recomposes same project script without a new research call',()=>{
 const stored={id:'same-project',product_name:'Combo NOIL + GODA',description:seller,
  video_duration_seconds:12,video_language:'es',creative_style:'ugc',status:'ready',
  concepts_json:JSON.stringify([concept,concept,concept]),
  findings_json:JSON.stringify({product_dossier:{actual_category:'shampoo y perfume'}}),
 };
 const previous=safeResearchResponse(stored);
 assert.equal(previous.video_duration_seconds,12);
 const current=improveSalesScript(previous.concepts[0].spoken_script,{
  seconds:15,style:'ugc',productName:stored.product_name,description:stored.description,
  concept:previous.concepts[0],report:previous.findings,
 });
 assert.ok(speechWords(current)>speechWords(previous.concepts[0].spoken_script));
 assert.ok(speechWords(current)>=voiceBudget(15,'ugc').minimum);
 assert.ok(!previous.concepts[0].name.includes('sin promesas mágicas'));
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 const approval=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(ui,/Duración final del video/);
 assert.match(ui,/video_duration_seconds:reviewDuration/);
 assert.match(ui,/improveSalesScript\(chosen\.spoken_script/);
 assert.match(approval,/resolvePremiumVideoChoice\(modelId,body.video_duration_seconds/);
 assert.match(approval,/SET status='approved',video_duration_seconds=\?/);
 assert.doesNotMatch(approval,/startOpenAIResearch/);
});
test('a new paid research uses vendor marketing positioning as an attributed claim, not a proven fact',()=>{
 const req=buildResearchRequest({OPENAI_PREMIUM_MODEL:'test',REALIZO_ENV:'sandbox'},{
  id:'p1',product_name:'Combo NOIL + GODA',description:seller,
  signedImage:'https://example.com/photo.png',video_language:'es',
  video_model_id:'seedance-2.5-intl-omni-reference',
  video_duration_seconds:15,market_code:'EC',creative_style:'ugc',sales_angle:'auto',
 });
 assert.match(req.instructions,/NOMBRES Y GUIONES QUE VENDEN/);
 assert.match(req.instructions,/No suprimas palabras como «feromonas» o «24 horas»/);
 assert.match(req.instructions,/Las observaciones de verificación van en product_dossier/);
 assert.equal(req.max_tool_calls,5);
 const route=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
 assert.match(route,/description:project.description/);
});
