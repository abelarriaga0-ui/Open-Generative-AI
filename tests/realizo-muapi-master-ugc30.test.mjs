import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLockedUgc30Prompt} from '../lib/realizo-creative/ugc-master-30.js';
import {AD_TEMPLATES,templatePlan} from '../lib/realizo-creative/ad-templates.js';

const input={
 duration:30,product:'Irrigador bucal',
 sellerDescription:'Irrigador bucal portátil para complementar la limpieza diaria',
 voice:'¿Quieres complementar tu limpieza diaria? Este irrigador bucal está diseñado para usar agua en tu rutina. Te muestro cómo se utiliza y cómo puede formar parte de tus hábitos. Escríbenos para conocerlo.',
 market:'EC',templateActor:'hombre',templateSetting:'auto',
 productGeometry:{
  products:[{name:'Irrigador',container_type:'Equipo portátil',
   body_shape:'Cuerpo compacto',closure_type:'Boquilla superior',main_colors:'blanco y azul'}],
  relative_pairs:[]
 },
};
test('only one 30s template is offered',()=>{
 assert.deepEqual(AD_TEMPLATES.map(t=>t.id),['ugc-vendedor']);
 assert.equal(AD_TEMPLATES[0].duration,30);
 assert.deepEqual(templatePlan('ugc-vendedor',30).map(x=>x.end),[3,9.2,17.9,24.3,30]);
});
test('Muapi template preserves timed sales beats, spoken Spanish, and new product',()=>{
 const prompt=buildLockedUgc30Prompt(input);
 assert.match(prompt,/0-3s HOOK HABLADO \| 3-9\.2s PROBLEMA\/DESEO/);
 assert.match(prompt,/9\.2-17\.9s PRODUCTO COMO SOLUCIÓN/);
 assert.match(prompt,/24\.3-30s CTA HABLADO/);
 assert.match(prompt,/MANDATORY AUDIO LANGUAGE: Spanish/);
 assert.match(prompt,/Irrigador bucal/);
 assert.match(prompt,/SPOKEN SCRIPT/);
 assert.match(prompt,/Use the uploaded product photograph ONLY as an identity/);
 assert.doesNotMatch(prompt,/Combo noil \+ goda|Hair Care Shampoo|For Him/);
 assert.ok(prompt.length<=5400);
});
test('explicit woman modification preserves everything else',()=>{
 const original=buildLockedUgc30Prompt(input);
 const updated=buildLockedUgc30Prompt({...input,templateChangeRequest:'Cámbialo por una mujer'});
 assert.match(original,/DEFAULT CREATOR: adult man/);
 assert.match(updated,/DEFAULT CREATOR: adult woman/);
 assert.match(updated,/EXPLICIT CUSTOMER CHANGE REQUEST: Cámbialo por una mujer/);
 assert.equal(original.split('SECOND-BY-SECOND SELLING PLAN')[1].split('PRODUCT:')[0],
              updated.split('SECOND-BY-SECOND SELLING PLAN')[1].split('PRODUCT:')[0]);
});
test('wrong duration fails before paid Muapi request',()=>{
 assert.throws(()=>buildLockedUgc30Prompt({...input,duration:15}),/template_requires_30_seconds/);
});
