import test from 'node:test';
import assert from 'node:assert/strict';
import {AD_TEMPLATES,getAdTemplate,templatePlan} from '../lib/realizo-creative/ad-templates.js';
import {makeLuxuryProductOnlyInput,LUXURY_TEMPLATE_MODEL_ID,LUXURY_TEMPLATE_ID} from '../lib/realizo-creative/luxury-product-only-template.js';
import {walletPilotAction} from '../lib/wallet/request-policy.js';

test('Luxury is a distinct reusable template visible beside UGC',()=>{
  assert.equal(AD_TEMPLATES.length,3);
  assert.ok(getAdTemplate('ugc-15-omni-voz-continua'));
  assert.ok(getAdTemplate('ugc-vendedor'));
  const t=getAdTemplate(LUXURY_TEMPLATE_ID);
  assert.equal(t.style,'premium');
  assert.equal(t.duration,8);
  assert.deepEqual(templatePlan(t,8).map(b=>[b.start,b.end]),[[0,2],[2,5],[5,8]]);
});

test('Nippori example preserves fixed Veo 3.1 reference-image generation contract',()=>{
  const photo='https://realizo-auth-sandbox.abelarriaga0.workers.dev/api/realizo/media/example?expires=0&sig=example';
  const data=makeLuxuryProductOnlyInput({
    productName:'Nippori',
    description:'Producto capilar con envase azul y tapa roja.',
    imageUrl:photo,visualDetail:'cap'
  });
  assert.equal(data.template_id,LUXURY_TEMPLATE_ID);
  assert.equal(data.model_id,LUXURY_TEMPLATE_MODEL_ID);
  assert.deepEqual(data.input.images_list,[photo]);
  assert.equal(data.input.duration,8);
  assert.equal(data.input.resolution,'720p');
  assert.equal(data.input.generate_audio,true);
  assert.match(data.input.prompt,/REALIZO LUXURY FILM CONTRACT v2/);
  assert.match(data.input.prompt,/REALIZO_REALISM_STANDARD v1/);
  assert.match(data.input.prompt,/3 designed shots total/);
  assert.match(data.input.prompt,/ABSOLUTE NO-VOICE AUDIO LOCK/);
  assert.match(data.input.prompt,/PRODUCT_ONLY: ZERO HUMAN PIXELS/);
  assert.match(data.input.prompt,/IMAGE IS NOT FIRST FRAME/);
  assert.doesNotMatch(data.input.prompt,/SPOKEN SCRIPT \(/);
});

test('Untrusted free-form visual-detail instructions cannot override product-only or audio lock',()=>{
  assert.throws(()=>makeLuxuryProductOnlyInput({
    productName:'Producto',
    description:'Descripción real de producto para una prueba.',
    imageUrl:'https://realizo.example/photo',
    visualDetail:'include a human'
  }),/invalid_luxury_template_payload/);
});


test('Production routing permits only the signed-in Luxury preparation endpoint',()=>{
 const route='/api/realizo/template/luxury/prepare';
 assert.equal(walletPilotAction(route,true,true),'allow');
 assert.equal(walletPilotAction(route,true,false),'deny');
 assert.equal(walletPilotAction('/api/realizo/template/arbitrary/prepare',true,true),'deny');
 assert.equal(walletPilotAction('/api/realizo/template/prepare',true,true),'deny');
 assert.equal(walletPilotAction('/api/wallet/quote',true,true),'allow');
});
