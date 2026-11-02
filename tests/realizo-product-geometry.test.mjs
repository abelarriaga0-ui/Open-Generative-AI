import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeProductGeometry,productGeometryPrompt} from '../lib/realizo-creative/product-geometry.js';
import {researchSchema,buildResearchRequest} from '../lib/realizo-creative/ai-premium.js';
import {buildCommercialDirectorPackage} from '../lib/realizo-creative/sales-director.js';

const photo={
 products:[
  {name:'NOIL',container_type:'Botella dispensadora',body_shape:'rectangular alta',
   closure_type:'pump',main_colors:'azul'},
  {name:'GODA',container_type:'Frasco gotero',body_shape:'pequeño y compacto',
   closure_type:'gotero negro',main_colors:'ámbar con etiqueta clara'},
 ],
 relative_pairs:[{
  larger:'NOIL',smaller:'GODA',same_depth:true,confidence:'medium',
  apparent_height_ratio:2.8,apparent_width_ratio:1.9,
 }],
};
test('the SAME paid research request captures packaging geometry without extra OpenAI calls',()=>{
 const schema=researchSchema();
 assert.ok(schema.required.includes('product_visual_geometry'));
 assert.ok(schema.properties.product_visual_geometry.properties.products);
 assert.ok(schema.properties.product_visual_geometry.properties.relative_pairs);
 const request=buildResearchRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna',REALIZO_ENV:'sandbox'},{
  id:'sample',signedImage:'https://example.test/combination.jpg',
  product_name:'Combo NOIL + GODA',description:'Shampoo y esencia',
  video_model_id:'seedance-2.5-intl-omni-reference',
  video_duration_seconds:12,creative_style:'ugc',market_code:'EC',
  video_language:'es',sales_angle:'auto',
 });
 assert.equal(request.input[0].content.filter(x=>x.type==='input_image').length,1);
 assert.equal(request.tool_choice,'required');
 assert.match(request.instructions,/product_visual_geometry/);
 assert.match(request.instructions,/same_depth=true/);
 const saved=readFileSync('app/api/realizo/ai-premium/[id]/route.js','utf8');
 assert.match(saved,/product_visual_geometry:report.product_visual_geometry/);
});
test('realistic scale hierarchy reaches the engine prompt before any prompt truncation',()=>{
 const director=buildCommercialDirectorPackage({
  concept:{name:'UGC',angle:'benefit',hook:'¿Listo para salir?',
   spoken_script:'NOIL completa tu rutina y GODA aporta el toque final de aroma.',
   video_prompt:'Presentador habla mirando a cámara'},
  modelId:'seedance-2.5-intl-omni-reference',duration:12,
  style:'ugc',productName:'Combo NOIL + GODA',productGeometry:photo,
 });
 assert.match(director.prompt,/PRODUCT PACKAGING GEOMETRY — HIGH PRIORITY/);
 assert.match(director.prompt,/NOIL must remain visibly larger than GODA/);
 assert.match(director.prompt,/approximately 2\.80x as tall/);
 assert.match(director.prompt,/approximately 1\.90x as wide/);
 assert.match(director.prompt,/correct hand grip/i);
 assert.ok(director.prompt.indexOf('PACKAGING GEOMETRY')<director.prompt.indexOf('SALES ANGLE'));
 assert.ok(director.prompt.length<=5400);
 assert.equal(director.product_geometry.products.length,2);
 const approve=readFileSync('app/api/realizo/ai-premium/[id]/approve/route.js','utf8');
 const editor=readFileSync('packages/studio/src/components/VideoStudio.jsx','utf8');
 assert.match(approve,/productGeometry:findings.product_visual_geometry/);
 assert.match(approve,/product_visual_geometry:director.product_geometry/);
 assert.match(editor,/productGeometry:preparedBrief.product_visual_geometry/);
});
test('no invented ratios from uncertain perspective, collage or missing dimensions',()=>{
 const uncertain={...photo,relative_pairs:[{
  ...photo.relative_pairs[0],same_depth:false,confidence:'low',
  apparent_height_ratio:4.2,apparent_width_ratio:3.4,
 }]};
 const result=productGeometryPrompt(uncertain);
 assert.match(result,/NOIL must remain visibly larger than GODA/);
 assert.doesNotMatch(result,/4\.20x|3\.40x/);
 const empty=productGeometryPrompt(null);
 assert.match(empty,/PACKAGING SCALE/);
 const invalid=normalizeProductGeometry({...photo,relative_pairs:[{
  ...photo.relative_pairs[0],apparent_height_ratio:99,
  apparent_width_ratio:-5,
 }]});
 assert.equal(invalid.relative_pairs[0].apparent_height_ratio,null);
 assert.equal(invalid.relative_pairs[0].apparent_width_ratio,null);
});
