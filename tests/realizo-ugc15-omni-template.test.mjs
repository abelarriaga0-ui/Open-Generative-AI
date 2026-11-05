import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AD_TEMPLATES,getAdTemplate,templatePlan} from '../lib/realizo-creative/ad-templates.js';
import {
 UGC15_TEMPLATE_ID,UGC15_TEMPLATE_MODEL_ID,UGC15_TEMPLATE_DURATION,
 UGC15_TEMPLATE_RESOLUTION,UGC15_TEMPLATE_ASPECT_RATIO,UGC15_TEMPLATE_QUALITY,
 UGC15_TEMPLATE_SAMPLE_EXPIRES,makeUgc15ReferenceInput
} from '../lib/realizo-creative/ugc15-omni-template.js';
import {normalizeLiveVideoInput} from '../lib/wallet/live-video-models.js';

const text=p=>readFileSync(p,'utf8');
test('UGC 15s successful-video template is registered in the library',()=>{
 assert.ok(AD_TEMPLATES.some(t=>t.id===UGC15_TEMPLATE_ID));
 const template=getAdTemplate(UGC15_TEMPLATE_ID);
 assert.equal(template.style,'ugc');
 assert.equal(template.duration,15);
 assert.equal(template.group,'UGC');
 const beats=templatePlan(template,15);
 assert.equal(beats.length,6);
 assert.deepEqual(beats.map(b=>b.start),[0,2.2,4.9,6.9,11,12.6]);
 assert.deepEqual(beats.map(b=>b.end),[2.2,4.9,6.9,11,12.6,15]);
 assert.ok(Number.isFinite(Date.parse(UGC15_TEMPLATE_SAMPLE_EXPIRES)));
 const library=text('components/RealizoTemplateLibrary.jsx');
 assert.match(library,/UGC15_TEMPLATE_ID/);
 assert.match(library,/onChoose\(ugc15\.id\)/);
 assert.match(library,/UGC15_TEMPLATE_SAMPLE_EXPIRES/);
});
test('template uses the exact requested Muapi model and reference payload',()=>{
 const data=makeUgc15ReferenceInput({
  productName:'Ejemplo Sustituible',
  description:'Accesorio de uso cotidiano para organizar objetos pequeños.',
  spokenScript:'¿Buscas organizar tus objetos de forma sencilla? Una rutina práctica empieza por tener cada cosa en su lugar. Con Ejemplo Sustituible, guarda los accesorios que necesitas, mantén lo esencial a mano y continúa con tu día. Escríbenos para conocer más.',
  buyerMotive:'Orden y comodidad',
  angle:'beneficio directo',imageUrl:'https://example.test/owned-product.jpg',
  products:[{name:'Accesorio',container_type:'estuche',body_shape:'rectangular',
   closure_type:'cremallera',main_colors:'negro'}]
 });
 assert.equal(data.template_id,UGC15_TEMPLATE_ID);
 assert.equal(data.model_id,'seedance-2-omni-reference');
 assert.equal(UGC15_TEMPLATE_MODEL_ID,'seedance-2-omni-reference');
 assert.equal(UGC15_TEMPLATE_DURATION,15);
 assert.deepEqual({
  duration:data.input.duration,resolution:data.input.resolution,
  quality:data.input.quality,aspect_ratio:data.input.aspect_ratio
 },{duration:15,resolution:'720p',quality:'high',aspect_ratio:'9:16'});
 assert.equal(UGC15_TEMPLATE_RESOLUTION,'720p');
 assert.equal(UGC15_TEMPLATE_ASPECT_RATIO,'9:16');
 assert.equal(UGC15_TEMPLATE_QUALITY,'high');
 assert.deepEqual(data.input.images_list,['https://example.test/owned-product.jpg']);
 assert.equal(data.input.video_files,null);
 assert.equal(data.input.audio_files,null);
 assert.match(data.input.prompt,/UGC VISUAL LOCK/);
 assert.match(data.input.prompt,/SPOKEN SCRIPT \(Spanish/);
 assert.match(data.input.prompt,/15 SECONDS/);
 assert.match(data.input.prompt,/0–2\.2s/);
 assert.match(data.input.prompt,/12\.6–15s/);
 assert.match(data.input.prompt,/VOICE|voice/i);
 assert.match(data.input.prompt,/Accesorio de uso cotidiano/);
 assert.doesNotMatch(data.input.prompt,/Candela|anti estr[ií]as|Goda/i);
 assert.ok(data.input.prompt.length<5700);
 assert.deepEqual(normalizeLiveVideoInput(data.model_id,data.input),data.input);
});
test('different products reuse the same camera and timeline but have their own content',()=>{
 const base={spokenScript:'Cuando cada detalle importa, empieza por elegir algo práctico. Usa este accesorio para ordenar lo que necesitas durante el día. Su diseño se integra en tu rutina diaria. Descubre una forma sencilla de llevar tus objetos y escríbenos para más información.',
  imageUrl:'https://example.test/photo.jpg'};
 const a=makeUgc15ReferenceInput({...base,productName:'Producto Uno',
  description:'Una cartera pequeña para organizar documentos cotidianos.'});
 const b=makeUgc15ReferenceInput({...base,productName:'Producto Dos',
  description:'Un estuche flexible para organizar cables y cargadores.'});
 assert.notEqual(a.input.prompt,b.input.prompt);
 assert.equal(a.input.duration,b.input.duration);
 assert.equal(a.input.quality,b.input.quality);
 assert.equal(a.input.resolution,b.input.resolution);
 assert.equal(a.input.aspect_ratio,b.input.aspect_ratio);
});
test('only the new specialized API prepares this recipe without exposing video files or editing price',()=>{
 const source=text('app/api/realizo/template/ugc15/prepare/route.js');
 const creator=text('components/RealizoTemplateCreator.jsx');
 assert.match(source,/requireWalletUser/);
 assert.match(source,/isOwnedSignedProductImage/);
 assert.match(source,/makeUgc15ReferenceInput/);
 assert.match(source,/spoken_script/);
 assert.doesNotMatch(source,/fetch\('https:\/\/api\.muapi\.ai/);
 assert.match(creator,/ugc15\?'\/api\/realizo\/template\/ugc15\/prepare'/);
 assert.match(creator,/UGC15_TEMPLATE_MODEL_ID/);
 assert.match(creator,/UGC15_TEMPLATE_RESOLUTION/);
 assert.match(creator,/UGC15_TEMPLATE_QUALITY/);
 assert.match(creator,/UGC15_TEMPLATE_ASPECT_RATIO/);
 assert.match(creator,/\/api\/wallet\/quote/);
 assert.match(creator,/\/api\/wallet\/generate/);
 assert.match(creator,/idempotency_key:idempotency/);
});
