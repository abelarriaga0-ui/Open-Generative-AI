import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHyperrealCommercialDirection,researchHyperrealDirection} from '../lib/realizo-creative/hyperreal-commercial.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {buildLockedUgc30Prompt} from '../lib/realizo-creative/ugc-master-30.js';
import {buildResearchRequest} from '../lib/realizo-creative/ai-premium.js';

const dialogue=[
 '¿Vas a salir y todavía te falta el toque final de tu rutina?',
 'Te arreglas, revisas tu ropa y te preocupas por tu presentación,',
 'pero a veces olvidas que el aroma también forma parte de esa primera impresión.',
 'La solución es completar la preparación con una fragancia que encaje contigo.',
 'Por eso conozco GODA, una esencia concentrada de perfume masculino.',
 'Se aplica siguiendo las indicaciones del producto y puedes incorporarla a tu rutina de salida.',
 'Presta atención al formato y elige la presentación que prefieras.',
 'Si te interesa GODA, escríbenos ahora y pide toda la información para conseguirlo.',
].join(' ');
const concept={
 name:'Primera impresión',angle:'sensory',creative_style:'ugc',
 hook:'¿Vas a salir y todavía te falta el toque final de tu rutina?',
 buyer_motive:'Cuidar el aroma personal antes de una cita',
 spoken_script:dialogue,
 cta:'Escríbenos ahora para pedir GODA',
 video_prompt:'A sales explanation with a real male actor',
 shots:['Introduction','Demonstration','CTA'],
};
function directed(style,description,options={}){
 return buildCommercialDirectorPackage({
  concept:{...concept,creative_style:style},
  productName:'GODA',description,cta:'Pide GODA hoy',
  duration:30,style,market:'EC',videoLanguage:'es',
  modelId:'seedance-2.5-intl-omni-reference',workflowId:'references',
  audioMode:style==='ugc'?'dialogue':style==='demo'?'voiceover':'no_voice',
  castMode:style==='premium'?'product_only':'with_people',
  ...options,
 });
}
test('UGC 30s directs every second: actor, shot, light, product, speech and CTA',()=>{
 const x=directed('ugc','GODA esencia concentrada de perfume masculino para completar la rutina y causar buena primera impresión');
 assert.match(x.prompt,/realizo-hyperreal-director-v1/);
 assert.match(x.prompt,/0–1s/);
 assert.match(x.prompt,/29–30s/);
 assert.match(x.prompt,/3500K/);
 assert.match(x.prompt,/charcoal cotton shirt/);
 assert.match(x.prompt,/CONTINUITY LOCK/);
 assert.match(x.prompt,/SPOKEN PERFORMANCE/);
 assert.match(x.prompt,/ONE-SECOND DIRECTOR TIMELINE/);
 assert.match(x.prompt,/irregular blinks/);
 assert.match(x.prompt,/CTA/);
 assert.match(x.prompt,/SPOKEN SCRIPT/);
 assert.ok(x.prompt.length<=12500,'does not exceed the bounded director prompt contract');
});
test('Demo is precise product usage, not perfume cinema, with spoken stages through 30s',()=>{
 const x=directed('demo','Irrigador bucal portátil con depósito de agua y boquilla para limpieza interdental',{productName:'Irrigador bucal',
   concept:{...concept,name:'Demostración práctica',angle:'demo',creative_style:'demo',
    buyer_motive:'Limpiar espacios interdentales de manera cómoda',
    spoken_script:'¿Te cuesta completar la limpieza entre tus dientes? Mira cómo funciona este irrigador portátil. Primero llena el depósito con agua, después coloca la boquilla y enciende el equipo siguiendo sus instrucciones. Ajusta el uso según el fabricante. Así puedes incorporar el equipo a la higiene bucal diaria. Escríbenos si quieres recibir información del irrigador y pedirlo hoy.',
   }});
 assert.match(x.prompt,/worktop height/);
 assert.match(x.prompt,/mechanism steps/);
 assert.match(x.prompt,/voice persists across shot transitions/);
 assert.match(x.prompt,/29–30s/);
 assert.doesNotMatch(x.prompt,/FASHION\/BEAUTY FILM STORYBOARD/);
 assert.ok(x.prompt.length<=12500);
});
test('Cinematic becomes a motivated real-life story with true microexpression and no UGC',()=>{
 const x=directed('cinematic','GODA perfume para hombres uso antes de salir');
 assert.match(x.prompt,/CINEMATOGRAPHIC PROFESSIONAL CINEMA COMMERCIAL/);
 assert.match(x.prompt,/micro-behavior/);
 assert.match(x.prompt,/180-degree screen direction/);
 assert.match(x.prompt,/ONE-SECOND DIRECTOR TIMELINE/);
 assert.doesNotMatch(x.prompt,/UGC TALKING-HEAD SCHEDULE/);
 assert.ok(x.prompt.length<=12500);
});
test('Premium product-only includes real materials and no humans or fake speech',()=>{
 const x=directed('premium','GODA perfume masculino esencia concentrada');
 assert.match(x.prompt,/ZERO HUMAN PIXELS/);
 assert.match(x.prompt,/Physically plausible 65–90mm/);
 assert.match(x.prompt,/no spoken dialogue is requested/i);
 assert.match(x.prompt,/29–30s/);
 assert.ok(x.prompt.length<=12500);
});
test('UGC locked 30s template keeps five master beats plus a complete 30s physical timeline',()=>{
 const prompt=buildLockedUgc30Prompt({
  duration:30,product:'GODA',sellerDescription:'GODA esencia concentrada de perfume para hombre',
  voice:dialogue,market:'EC',templateActor:'hombre',templateSetting:'auto',
 });
 assert.match(prompt,/0-3s HOOK HABLADO/);
 assert.match(prompt,/9\.2-17\.9s PRODUCTO COMO SOLUCIÓN/);
 assert.match(prompt,/24\.3-30s CTA HABLADO/);
 assert.match(prompt,/ONE-SECOND DIRECTOR TIMELINE/);
 assert.match(prompt,/29–30s/);
 assert.match(prompt,/CONTINUITY LOCK/);
 assert.ok(prompt.length<=12500);
});
test('Visual directions vary with product context without fixing actor ethnicity or false product effects',()=>{
 const seller='GODA perfume masculino';
 const scent=buildHyperrealCommercialDirection({style:'demo',duration:12,product:'GODA',
  sellerDescription:seller,voice:dialogue});
 const dental=buildHyperrealCommercialDirection({style:'demo',duration:12,product:'Irrigador',
  sellerDescription:'Irrigador bucal equipo portátil eléctrico',voice:dialogue});
 const skincare=buildHyperrealCommercialDirection({style:'ugc',duration:12,product:'Candela',
  sellerDescription:'Crema de cuidado corporal para piel con estrías',voice:dialogue});
 assert.match(scent,/dressing area/);
 assert.match(dental,/desk or working area|daily-use environment/);
 assert.match(skincare,/home bathroom/);
 assert.notEqual(scent,skincare);
 assert.doesNotMatch(scent,/skin color must be white|female compliments|guaranteed seduction/);
});
test('Research AI receives detailed 30s physical-scene direction with no model switch or extra call',()=>{
 const request=buildResearchRequest({OPENAI_PREMIUM_MODEL:'research-model',REALIZO_ENV:'production'},{
  id:'research-1',product_name:'GODA',
  description:'GODA esencia de perfume concentrada para hombre con presentación en gotero',
  market_code:'EC',video_language:'es',video_duration_seconds:30,
  video_model_id:'seedance-2.5-intl-omni-reference',creative_style:'demo',
  cast_mode:'with_people',audio_mode:'voiceover',sales_angle:'auto',
  signedImage:'https://example.org/reference.png'
 });
 assert.equal(request.model,'research-model');
 assert.match(request.instructions,/HYPERREAL VISUAL DIRECTOR CONTRACT/);
 assert.match(request.instructions,/DEM O|DEMO: practical problem/);
 assert.match(request.instructions,/second-by-second action progression/);
 assert.equal(request.tools[0].type,'web_search');
 assert.equal(request.background,true);
 assert.match(researchHyperrealDirection({seconds:30,style:'ugc'}),/30s/);
});
