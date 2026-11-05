import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SALES_ANGLE_CHOICES,normalizeSalesAngle,salesAngleDirective,ANGLES} from '../lib/realizo-creative/sales-angle.js';
import {validatePremiumInput,buildResearchRequest,researchFingerprint} from '../lib/realizo-creative/ai-premium.js';
import {premiumVideoOptions} from '../lib/realizo-creative/video-specs.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';

const video=premiumVideoOptions()[0];
const brief={
 product_name:'Goda',description:'Fragancia masculina para una rutina personal antes de salir.',
 primary_asset_id:'00000000-0000-4000-8000-000000000001',
 request_key:'customangle123456789',market:'EC',
 creative_style:'premium',cast_mode:'with_people',audio_mode:'voiceover',
 video_model_id:video.id,video_duration_seconds:video.durations[0]
};

test('sales motive dropdown differs from audiovisual format and still supports old templates',()=>{
 const ids=SALES_ANGLE_CHOICES.map(([id])=>id);
 for(const id of ['auto','seduction','health','beauty','wellness','confidence','comfort','savings','security','performance','gifting','custom'])
  assert.ok(ids.includes(id),id);
 for(const id of ['ugc','demo','premium','sensory','problem','benefits'])
  assert.ok(!ids.includes(id),'production format or old structure must not be displayed: '+id);
 for(const legacy of ['premium','benefits','problem','demo','ugc','lifestyle'])
  assert.ok(ANGLES.includes(legacy),'old saved creative/template code '+legacy);
 const ui=readFileSync('components/RealizoPremium.jsx','utf8');
 assert.match(ui,/SALES_ANGLE_CHOICES\.map/);
 assert.match(ui,/product\.angle==='custom'/);
 assert.match(ui,/value=\{product\.custom_angle\}/);
 assert.match(ui,/maxLength=\{240\}/);
 assert.match(ui,/custom_angle:''/);
});
test('free-angle is validated, stored in one existing field and never silently truncated',()=>{
 const raw=' Quiero mostrar el deseo de causar una buena impresión sin prometer atraer mujeres. ';
 const persisted=normalizeSalesAngle('custom',raw);
 assert.equal(persisted,'custom:'+raw.trim());
 assert.equal(salesAngleDirective(persisted),raw.trim());
 assert.equal(normalizeSalesAngle('custom','corto'),null);
 assert.equal(normalizeSalesAngle('custom','x'.repeat(241)),null);
 assert.equal(normalizeSalesAngle('unknown','texto válido'),null);
 assert.equal(normalizeSalesAngle('seduction'),'seduction');
 const normal=validatePremiumInput({...brief,angle:'custom',custom_angle:raw});
 assert.equal(normal.angle,persisted);
 assert.equal(validatePremiumInput({...brief,angle:'health'}).angle,'health');
 assert.throws(()=>validatePremiumInput({...brief,angle:'custom',custom_angle:'corto'}),/invalid_request/);
 assert.throws(()=>validatePremiumInput({...brief,angle:'custom',custom_angle:'a'.repeat(241)}),/invalid_request/);
});
test('research prompt and fingerprint both change with freely authored motive',async()=>{
 const base=validatePremiumInput({...brief,angle:'custom',custom_angle:'Que el comprador se vea elegante al salir de casa'});
 const alt=validatePremiumInput({...brief,angle:'custom',custom_angle:'Que el comprador se sienta preparado para regalarlo'});
 assert.notEqual(await researchFingerprint(base),await researchFingerprint(alt));
 const request=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-5.5'},{
  ...brief,id:'00000000-0000-4000-8000-000000000002',market_code:'EC',
  sales_angle:base.angle,signedImage:'https://example.test/ref.png',video_language:'es',
 });
 assert.match(request.instructions,/PRIORIDAD COMERCIAL DEL CLIENTE/);
 assert.match(request.instructions,/tres conceptos|TRES conceptos/i);
 assert.match(request.instructions,/Que el comprador se vea elegante al salir de casa/);
 assert.match(request.input[0].content[0].text,/sales_motivation_requested/);
 assert.equal(request.max_tool_calls,5);
});
test('approval uses saved motive and passes it to a final director prompt',()=>{
 const route=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.match(route,/requested_sales_angle:salesAngleDirective\(project\.sales_angle\)/);
 assert.doesNotMatch(route,/body\.(?:custom_angle|angle)/);
 const poll=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
 assert.match(poll,/salesAngle:project\.sales_angle\|\|'auto'/);
 const concept={
  name:'Goda antes de salir',angle:'confidence',creative_style:'premium',
  hook:'El último paso antes de salir',buyer_motive:'Sentirse bien presentado',
  video_prompt:'Un adulto se arregla con el producto real en una habitación',
  spoken_script:'Antes de salir, dale a tu rutina ese toque personal con Goda. Pídelo hoy.',
  cta:'Pídelo hoy',shots:['Arreglarse','Mostrar producto','Salir']
 };
 const packageResult=buildCommercialDirectorPackage({
  concept:{...concept,requested_sales_angle:'Transmitir seguridad al prepararte antes de una cita'},
  productName:'Goda',description:'Perfume para uso personal',
  style:'premium',castMode:'with_people',audioMode:'voiceover',
  duration:8,modelId:video.id,workflowId:'references',imageProvided:true
 });
 assert.match(packageResult.prompt,/CUSTOMER-CHOSEN SALES MOTIVE/);
 assert.match(packageResult.prompt,/Transmitir seguridad al prepararte antes de una cita/);
 assert.match(packageResult.prompt,/AUDIO VOICEOVER/);
});
