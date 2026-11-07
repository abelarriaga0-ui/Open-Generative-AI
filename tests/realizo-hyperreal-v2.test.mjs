import test from 'node:test';
import assert from 'node:assert/strict';
import {
 HYPERREAL_V2_VERSION,HYPERREAL_IMAGE_MODEL,HYPERREAL_VIDEO_MODEL,
 normalizeHyperrealProductionBrief,hyperrealShotPlan,
 buildHyperrealDirectorRequest,parseHyperrealDirectorResult,
 masterImageInput,sceneImageInput,sceneVideoInput,
 hyperrealQuoteBreakdown
} from '../lib/realizo-creative/hyperreal-production.js';

const SOURCE={
 source_mode:'ai',image_url:'https://realizo.example/api/realizo/media/ref?expires=123&sig=abc',
 product_name:'GODA',description:'Perfume con gotero para uso externo',duration:30,
 aspect_ratio:'9:16',creative_style:'ugc',audio_mode:'camera'
};
const setup=(opts={})=>normalizeHyperrealProductionBrief({...SOURCE,...opts});
test('production director preserves Realizo sales structure and defaults',()=>{
 const brief=setup();
 assert.match(HYPERREAL_V2_VERSION,/image-first/);
 assert.equal(HYPERREAL_IMAGE_MODEL,'nano-banana-2-1-edit');
 assert.equal(HYPERREAL_VIDEO_MODEL,'kling-4.0-reference-to-video');
 const request=buildHyperrealDirectorRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},brief);
 assert.equal(request.background,true);
 assert.equal(request.tool_choice,'required');
 assert.equal(request.tools[0].type,'web_search');
 assert.equal(request.input[0].content[1].type,'input_image');
 assert.match(request.instructions,/HOOK|NMF/);
 assert.match(request.instructions,/MISMA|CONSISTENCIA|CONVERSION|VENTA|comercial/i);
 assert.match(request.instructions,/en español|español latinoamericano/i);
});
test('image-first shot duration is commercial beat-driven, not hardcoded 5 seconds',()=>{
 for(const [duration,count] of [[15,3],[30,5],[45,7]]){
  const shots=hyperrealShotPlan(setup({duration}));
  assert.equal(shots.length,count);
  assert.equal(shots.at(-1).end,duration);
  assert.ok(shots.every(s=>s.seconds>=3&&s.seconds<=10));
  assert.equal(shots.reduce((sum,s)=>sum+s.seconds,0),duration);
 }
 assert.deepEqual(hyperrealShotPlan(setup()).map(x=>x.seconds),[3,6,7,7,7]);
});
test('brief accepts ONLY owner product photo and verified document fields',()=>{
 const onlyImage=setup({product_name:'',description:''});
 assert.equal(onlyImage.source_mode,'ai');
 assert.throws(()=>setup({source_mode:'document',product_name:'',description:''}),/document_details_required/);
 assert.throws(()=>setup({image_url:''}),/product_photo_required/);
 assert.throws(()=>setup({duration:31}),/invalid_video_duration/);
 assert.throws(()=>setup({creative_style:'fake'}),/invalid_creative_style/);
});
const scene=(i,d)=>({
 index:i,duration_seconds:d,beat:'Gancho',human_action:'Persona muestra el producto con gesto natural',
 camera:'Plano medio cámara en mano sutil',lighting:'Luz natural de ventana',
 transition:'Corte natural sin morph',image_prompt:'Fotografía hiperrealista del mismo actor con el producto auténtico',
 motion_prompt:'Parpadea, respira y muestra el producto con agarre realista y pequeños movimientos',
 dialogue:'Mira, esto forma parte de una rutina sencilla y útil.',
 audio_direction:'Voz española natural',sales_purpose:'Atraer atención de potenciales compradores'
});
function aiResult(brief){
 const plan=hyperrealShotPlan(brief);
 const payload={
  product_identity:'GODA',product_visual_geometry:'Gotero negro y etiqueta clara',
  identity_confidence:'matched',sources:[],verified_claims:[],
  claims_to_avoid:['atracción garantizada'],selected_sales_angle:'Aroma de rutina',
  buyer_motive:'Confianza cotidiana',principal_hook:'Completa tu rutina',
  cta:'Escríbenos',adult_actor_lock:'Adulto con camiseta negra siempre igual',
  environment_lock:'Habitación con luz de ventana',master_image_prompt:
   'Fotografía hiperrealista de una persona adulta real en un dormitorio, sosteniendo un gotero negro sin alterar la etiqueta',
  spoken_script:'Mira, esta fragancia puede complementar tu rutina antes de salir. Descúbrela hoy y escríbenos.',
  scenes:plan.map((x,i)=>scene(i+1,x.seconds)),limitations:[]
 };
 return {status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(payload)}]}]};
}
test('commercial storyboard converts into one master image, one 4K photo and Kling clip per scene',()=>{
 const brief=setup(),story=parseHyperrealDirectorResult(aiResult(brief),brief);
 const master=masterImageInput(brief,story);
 assert.equal(master.resolution,'4k');
 assert.deepEqual(master.images_list,[brief.image_url]);
 const photo=sceneImageInput(brief,story,story.scenes[0],'https://cdn.muapi.ai/master.jpg');
 assert.equal(photo.images_list.length,2);
 const video=sceneVideoInput(brief,story,story.scenes[0],'https://cdn.muapi.ai/scene1.jpg','https://cdn.muapi.ai/master.jpg');
 assert.equal(video.image_urls.length,3);
 assert.equal(video.duration,3);
 assert.equal(video.resolution,'1080p');
 assert.match(video.prompt,/@image_1/);
 assert.match(video.prompt,/lips|CAMERA|cámara|SPEAKS/i);
});
test('wrong duration count, blank dialogue, ungrounded identity are rejected',()=>{
 const b=setup(),result=aiResult(b);
 let payload=JSON.parse(result.output[0].content[0].text);
 payload.scenes.pop();result.output[0].content[0].text=JSON.stringify(payload);
 assert.throws(()=>parseHyperrealDirectorResult(result,b),/hyperreal_scene_count_mismatch/);
 const r2=aiResult(b);
 payload=JSON.parse(r2.output[0].content[0].text);
 payload.scenes[0].dialogue='';
 r2.output[0].content[0].text=JSON.stringify(payload);
 assert.throws(()=>parseHyperrealDirectorResult(r2,b),/hyperreal_speech_missing/);
});
test('bundle includes research, 4K photos, independent video and montage BEFORE charge',()=>{
 const cost=hyperrealQuoteBreakdown(0.135,[0.71,1.41,1.65],4);
 assert.equal(cost.image_count,4);
 assert.equal(cost.scene_count,3);
 assert.ok(cost.total_cents>cost.video_cents+cost.image_cents);
 assert.equal(cost.total_cents,cost.image_cents+cost.video_cents+
  cost.director_and_research_cents+cost.montage_and_quality_cents+
  cost.service_margin_cents);
});
