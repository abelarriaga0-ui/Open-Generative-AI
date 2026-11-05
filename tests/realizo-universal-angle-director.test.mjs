import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';
import {angleDirectionContract,conceptSceneContract} from '../lib/realizo-creative/angle-director.js';
import {salesAngleDirective} from '../lib/realizo-creative/sales-angle.js';

const SKU='PRODUCT-UNDER-TEST';
function render({angle='health',style='premium',castMode='with_people',scene,shots,productName=SKU,spokenScript='' }={}){
 const concept={
  name:'Hipótesis elegida',creative_style:style,angle:angle,
  sales_angle_code:angle,
  requested_sales_angle:salesAngleDirective(angle),
  hook:'UNIQUE HOOK: el primer fotograma demuestra el deseo del comprador',
  buyer_motive:'Satisfacer una intención de compra observable',
  video_prompt:scene||'An adult visibly uses the item in a distinct situation and gets a believable response',
  shots:shots||['The first-frame event starts the story','The object enters the action','A visual response resolves the intention'],
  cta:'Conoce esta opción',spoken_script:spokenScript,
 };
 return buildCommercialDirectorPackage({
  concept,productName,description:'Artículo comercial físico de uso cotidiano',
  modelId:'seedance-2.5-intl-omni-reference',workflowId:'references',
  style,castMode,audioMode:'no_voice',duration:8,
 });
}
test('Premium/Cine preserve unique researched scene and buyer angle, not a generic product-only montage',()=>{
 for(const style of ['premium','cinematic']){
  for(const [angle,scene] of [
   ['seduction','ADULT MUTUAL GLANCE then a distinctive reciprocal flirtation moment'],
   ['health','An adult organizes a caring routine around a supported daily need'],
   ['performance','An adult operates a tool with visible correct mechanical motion'],
   ['gifting','An adult opens an occasion-specific gift and reacts with appreciation'],
   ['savings','An adult compares verified quantities before making a choice'],
  ]){
   const film=render({angle,style,scene});
   assert.match(film.prompt,/UNIVERSAL BUYER-ANGLE VISUAL CONTRACT/);
   assert.match(film.prompt,/APPROVED CONCEPT STORYBOARD/);
   assert.ok(film.prompt.includes(scene),angle+' scene must reach Muapi as primary filming action');
   assert.match(film.prompt,/RESEARCHED SHOT ACTIONS/);
   assert.match(film.prompt,/LUXURY BRAND FILM TIMELINE/);
   assert.match(film.prompt,/NOT replace researched cast interaction|NEVER replace researched cast interaction/);
   assert.match(film.prompt,/REFERENCE PRODUCT PHOTOGRAPH/);
   assert.ok(film.prompt.length<=12500);
  }
 }
});
test('Buyer angle and output format stay independent; product identity is not the sales angle',()=>{
 const sexy=render({angle:'seduction',scene:'Two adult actors exchange a meaningful look'});
 assert.match(sexy.prompt,/suggestive wardrobe/);
 assert.match(sexy.prompt,/adult attraction story/i);
 assert.match(sexy.prompt,/mutually|reciprocal/i);
 const healthy=render({angle:'health',scene:'Adult calmly handles a health-related daily routine'});
 assert.match(healthy.prompt,/credible adult care need/);
 assert.doesNotMatch(healthy.prompt,/sensual ADULT attraction story/);
 const savings=render({angle:'savings',scene:'Observe real package quantities'});
 assert.match(savings.prompt,/only show prices, discounts or numeric comparisons if explicitly supported/);
 assert.doesNotMatch(savings.prompt,/intimate but non-explicit proximity/);
 const mode=render({angle:'seduction',castMode:'product_only',scene:'Silk and warm light around a physical object'});
 assert.match(mode.prompt,/Do not introduce people when product-only was chosen/);
 assert.match(mode.prompt,/ABSOLUTE PRODUCT-ONLY CAST LOCK/);
});
test('Free-text sales angle reaches final prompt and does not become a new format',()=>{
 const raw='Mostrar una familia preparando una celebración con ambiente luminoso';
 const brief=render({angle:'custom:'+raw,style:'premium',scene:'A family prepares decorations around a product'});
 assert.ok(brief.prompt.includes(raw));
 assert.match(brief.prompt,/FORMAT premium governs camera/);
 assert.match(brief.prompt,/PRIMARY FILMED EVENTS: A family prepares decorations/);
});
test('UGC and Demo preserve angle code, story and user-authorized narration',()=>{
 const voice='¿Quieres una solución práctica? Este artículo te ayuda en una tarea diaria. Descubre cómo funciona y escríbenos hoy.';
 for(const style of ['ugc','demo']){
  const r=render({angle:'comfort',style,scene:'Adult completes a comfortable everyday action',spokenScript:voice});
  assert.match(r.prompt,/UNIVERSAL BUYER-ANGLE VISUAL CONTRACT/);
  assert.match(r.prompt,/APPROVED CONCEPT STORYBOARD/);
  assert.match(r.prompt,/SPOKEN SCRIPT/);
  assert.match(r.prompt,/comfort|Comodidad/i);
  assert.ok(r.prompt.includes(voice),'authorized dialogue was dropped');
 }
});
test('No product-specific romance ban or hardcoded sample SKU dictates other customers advertising',()=>{
 const research=readFileSync('lib/realizo-creative/ai-premium.js','utf8');
 const approved=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 assert.doesNotMatch(research,/Nunca muestres la reacción imaginaria de una mujer al olor/i);
 assert.match(research,/No neutralices la intensidad del ángulo/);
 assert.match(research,/CONSERVA su dirección emocional y visual/);
 assert.match(approved,/sales_angle_code:project.sales_angle\|\|'auto'/);
 assert.match(approved,/requested_sales_angle:salesAngleDirective\(project.sales_angle\)/);
 assert.match(approved,/buildCommercialDirectorPackage/);
});
test('Universal angle direction never overrides the chosen cast or requires a specific SKU',()=>{
 const outcome=angleDirectionContract({
  salesAngle:'seduction',castMode:'product_only',creativeStyle:'premium',
  requestedSalesAngle:salesAngleDirective('seduction'),
 });
 assert.match(outcome,/product-only was chosen/);
 assert.doesNotMatch(outcome,/suggestive wardrobe/);
 const storyboard=conceptSceneContract({videoPrompt:'An adult handles an everyday physical item',duration:12});
 assert.match(storyboard,/PRIMARY FILMED EVENTS/);
 assert.match(storyboard,/12 seconds/);
});
