import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {salesBeatPlan} from '../lib/realizo-creative/sales-storyboard.js';
import {FORMAT_GUIDES} from '../lib/realizo-creative/format-guides.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {buildResearchRequest} from '../lib/realizo-creative/ai-premium.js';

const concept={
 name:'La rutina que cambia el momento',
 angle:'problem',creative_style:'cinematic',hook:'¿Te falta algo antes de salir?',
 buyer_motive:'Completar rutina de cabello y aroma',
 spoken_script:'¿Te falta algo antes de salir? Prueba dos pasos: NOIL para el cabello y GODA para el aroma. Completa tu rutina y consulta el combo hoy.',
 video_prompt:'Persona se prepara para salir, usa los productos, resuelve la necesidad y cierra hablando.',
 cta:'Consulta el combo hoy',
};
test('scroll-stopping hook is about 3s in 12-second ads, never over 3 seconds',()=>{
 for(const style of ['ugc','cinematic','premium','demo']){
  assert.equal(salesBeatPlan(12,style)[0].end,2.9);
  for(const seconds of [4,6,8,10,12,15,30,45,60,120]){
   const beats=salesBeatPlan(seconds,style);
   assert.equal(beats.length,5);
   assert.ok(beats[0].end<=3,`${style} ${seconds}s hook is too long`);
   assert.ok(beats[0].end>0);
   assert.equal(beats[4].end,seconds);
   assert.ok(beats.slice(1).every((b,i)=>b.start>=beats[i].end && b.end>b.start));
  }
 }
});
test('cinematic feeling includes real editing, transitions, sound design and effects BEFORE prompt truncation',()=>{
 const pack=buildCommercialDirectorPackage({
  concept,productName:'Combo NOIL + GODA',description:'Shampoo y perfume',style:'cinematic',
  duration:12,modelId:'seedance-2.5-intl-omni-reference',
 });
 assert.match(pack.prompt,/HOOK TIMING — HARD EDITORIAL RULE/);
 assert.match(pack.prompt,/0-2.9s maximum/);
 assert.match(pack.prompt,/3 seconds is the absolute maximum/);
 assert.match(pack.prompt,/STYLE-SPECIFIC POSTPRODUCTION & FINISHING/);
 assert.match(pack.prompt,/Match cuts/i);
 assert.match(pack.prompt,/whip pan|speed ramp/i);
 assert.match(pack.prompt,/SOUND DESIGN/i);
 assert.match(pack.prompt,/FOLEY|foley/i);
 assert.match(pack.prompt,/SPOKEN SCRIPT/);
 assert.match(pack.prompt,/NOIL/);
 assert.match(pack.prompt,/GODA/);
 assert.ok(pack.prompt.indexOf('SPOKEN SCRIPT')<pack.prompt.indexOf('STYLE-SPECIFIC POSTPRODUCTION'));
 assert.ok(pack.prompt.length<=5400);
 assert.match(FORMAT_GUIDES.cinematic.transitions,/Match cuts/);
 assert.match(FORMAT_GUIDES.cinematic.effects,/gradación/);
});
test('premium has tactile color/light/editing but UGC avoids fake cinematic effects',()=>{
 for(const style of ['premium','ugc','demo']){
  const pack=buildCommercialDirectorPackage({...{
   concept:{...concept,creative_style:style},productName:'NOIL',
   description:'Shampoo',duration:12,modelId:'seedance-2.5-intl-omni-reference',style,
  }});
  assert.match(pack.prompt,/HOOK TIMING/);
  assert.match(pack.prompt,/SPOKEN SCRIPT/);
  assert.match(pack.prompt,/STYLE-SPECIFIC POSTPRODUCTION/);
 }
 assert.match(FORMAT_GUIDES.premium.effects,/macro óptico/);
 assert.match(FORMAT_GUIDES.premium.sound_design,/Foley/);
 assert.match(FORMAT_GUIDES.ugc.transitions,/no whip pan/);
 assert.match(FORMAT_GUIDES.demo.transitions,/Corte sobre acción/);
});
test('research sends short-hook and cinematic editing rules in existing single web-backed request',()=>{
 const req=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-test',REALIZO_ENV:'sandbox'},{
  id:'test-id',signedImage:'https://example.org/photo.jpg',
  product_name:'Combo NOIL + GODA',description:'Shampoo y perfume',market_code:'EC',
  creative_style:'cinematic',video_duration_seconds:12,video_model_id:'seedance-2.5-intl-omni-reference',
  video_language:'es',sales_angle:'auto',
 });
 assert.match(req.instructions,/EL HOOK debe detener el scroll en un máximo de 3 segundos/);
 assert.match(req.instructions,/CINEMATOGRÁFICO Y PREMIUM NO SON SOLO CÁMARAS/);
 assert.match(req.instructions,/EDICIÓN:/);
 assert.match(req.instructions,/TRANSICIONES:/);
 assert.match(req.instructions,/EFECTOS:/);
 assert.match(req.instructions,/SONIDO:/);
 assert.equal(req.input[0].content.filter(x=>x.type==='input_image').length,1);
 assert.equal(req.max_tool_calls,5);
 assert.equal(req.tool_choice,'required');
 const studio=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(studio,/dynamicDirection/);
});
