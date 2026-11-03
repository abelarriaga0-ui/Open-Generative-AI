import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 DEFAULT_BRIEF,normalizeImageBrief,presetFromBrief,buildResearchSystemPrompt,
 buildResearchUserPrompt,parseCreativeResearch,buildSalesImagePrompt
} from '../lib/realizo-images/creative.js';

test('formatos y estilos de anuncios independientes de la antigua plantilla rígida',()=>{
 for(const ratio of ['1:1','4:5','9:16','16:9']){
  const brief=normalizeImageBrief({...DEFAULT_BRIEF,aspect_ratio:ratio});
  const prompt=buildSalesImagePrompt(brief,{angle:'Venta diaria',visual_direction:'Fondo editorial'});
  assert.match(prompt,new RegExp(ratio.replace(':','\\:')));
  assert.match(prompt,/NO replique una plantilla previa/);
  assert.match(prompt,/identidad exacta del producto/);
 }
 assert.throws(()=>normalizeImageBrief({...DEFAULT_BRIEF,aspect_ratio:'bad'}),/invalid_image_options/);
});
test('con y sin precio implican prompts distintos; jamás inventar oferta',()=>{
 const no=buildSalesImagePrompt({...DEFAULT_BRIEF,show_price:false},
  {angle:'Lanzamiento',visual_direction:'Composición premium'});
 assert.match(no,/PROHIBIDO mostrar precio/);
 const yes=buildSalesImagePrompt({...DEFAULT_BRIEF,show_price:true,price:'$29.99'},
  {angle:'Lanzamiento',visual_direction:'Composición premium'});
 assert.match(yes,/\$29.99/);
 assert.match(yes,/sin inventar descuentos/);
 assert.throws(()=>normalizeImageBrief({...DEFAULT_BRIEF,show_price:true,price:''}),/price_required/);
});
test('plantillas nunca guardan producto anterior ni precio; sí estilo',()=>{
 const p=presetFromBrief({...DEFAULT_BRIEF,creative_type:'ugc',aspect_ratio:'9:16',
  product_name:'Producto anterior',product_benefit:'Un beneficio',show_price:true,price:'$29.99'});
 assert.equal(p.product_name,'');assert.equal(p.product_benefit,'');assert.equal(p.price,'');
 assert.equal(p.creative_type,'ugc');assert.equal(p.show_price,true);assert.equal(p.aspect_ratio,'9:16');
});
test('respuesta Gemini JSON y pauta NMF sin afirmaciones inventadas',()=>{
 const sample={outputs:['{"category":"capilar","angle":"rutina práctica","audience":"adultos","hook":"La rutina más sencilla","benefit":"Presentación compacta","cta":"Conócelo","visual_direction":"luz natural","research_note":"Inferencia"}']};
 const research=parseCreativeResearch(sample);
 assert.equal(research.angle,'rutina práctica');
 assert.match(buildResearchSystemPrompt(),/No inventes ingredientes/);
 const user=buildResearchUserPrompt({...DEFAULT_BRIEF,product_name:'Producto'},);
 assert.match(user,/imagen/i);
 const prompt=buildSalesImagePrompt({...DEFAULT_BRIEF,product_name:'Producto'},research);
 assert.match(prompt,/hook visual inmediato|captar la atención/i);
 assert.match(prompt,/NO inventar testimonios/);
});
test('servidor exige propiedad de imagen, sesión y cobro idempotente',async()=>{
 const {readFileSync}=await import('node:fs');
 const base=new URL('../app/api/realizo/images/',import.meta.url);
 for(const route of ['upload/route.js','analyze/route.js','generate/route.js','presets/route.js']){
  const src=readFileSync(new URL(route,base),'utf8');
  assert.match(src,/requireWalletUser/);
  assert.match(src,/enforceSameOrigin|GET\(request\)/);
 }
 const submitted=readFileSync(new URL('generate/route.js',base),'utf8');
 assert.match(submitted,/createReservedJob/);
 assert.match(submitted,/source\.upload_id!==body\.upload_id/);
 assert.match(submitted,/\['completed','failed'\]/);
 assert.match(submitted,/nano-banana-2-1-edit/);
});
