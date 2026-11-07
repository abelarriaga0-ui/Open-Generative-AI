import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hyperrealModelFamilies,resolveHyperrealModelFamily,buildKling40HyperrealParams,
  KLING_40_FAMILY,KLING_40_REFERENCE,KLING_40_TEXT
} from '../lib/realizo-creative/hyperreal-model-routing.js';

const models=[
  {id:'seedance-2.5-intl-omni-reference',family_id:'seedance-2.5',
   family:'Seedance 2.5',image_role:'product_reference',workflow_id:'references',durations:[15,30]},
  {id:'seedance-2.5-text-to-video',family_id:'seedance-2.5',
   family:'Seedance 2.5',image_role:'none',workflow_id:null,durations:[15,30]},
  {id:'seedance-2.5-intl-text-to-video',family_id:'seedance-2.5',
   family:'Seedance 2.5',image_role:'none',workflow_id:null,durations:[15,30]},
  {id:'seedance-2.5-image-to-video',family_id:'seedance-2.5',
   family:'Seedance 2.5',image_role:'start_frame',workflow_id:'animate_image',durations:[15,30]},
  {id:'veo3.1-reference-to-video',family_id:'veo-3.1',
   family:'Veo 3.1',image_role:'product_reference',workflow_id:'references',durations:[8,15]}
];
test('one model name per family hides technical endpoints',()=>{
  const list=hyperrealModelFamilies(models);
  assert.equal(list.filter(m=>m.id==='seedance-2.5').length,1);
  assert.equal(list.filter(m=>m.id===KLING_40_FAMILY).length,1);
  assert.equal(list.find(m=>m.id===KLING_40_FAMILY).label,'Kling 4.0');
});
test('photo chooses real reference workflow, no photo chooses text to video',()=>{
  const image=resolveHyperrealModelFamily(models,'seedance-2.5',30,{hasImage:true});
  const text=resolveHyperrealModelFamily(models,'seedance-2.5',30,{hasImage:false});
  assert.equal(image.modelId,'seedance-2.5-intl-omni-reference');
  assert.equal(image.workflowId,'references');
  assert.equal(text.modelId,'seedance-2.5-intl-text-to-video');
  assert.equal(text.imageRole,'none');
});
test('never silently turn an identity reference into a start frame',()=>{
  assert.throws(()=>resolveHyperrealModelFamily(models,'veo-3.1',8,{hasImage:false}),
    /text_video_model_required/);
});
test('Kling 4 routes only valid direct provider variants and documented durations',()=>{
  const image=resolveHyperrealModelFamily(models,KLING_40_FAMILY,30,{hasImage:true});
  assert.equal(image.modelId,KLING_40_REFERENCE);
  const video=buildKling40HyperrealParams({
    choice:image,prompt:'A real person holds the product.',
    imageUrl:'https://realizo.example/api/realizo/media/uuid?sig=abc',aspectRatio:'9:16'
  });
  assert.equal(video.model,KLING_40_REFERENCE);
  assert.equal(video.image_urls.length,1);
  assert.match(video.prompt,/@image_1/);
  assert.equal(video.resolution,'1080p');
  const text=resolveHyperrealModelFamily(models,KLING_40_FAMILY,15,{hasImage:false});
  assert.equal(text.modelId,KLING_40_TEXT);
  assert.throws(()=>resolveHyperrealModelFamily(models,KLING_40_FAMILY,45,{hasImage:true}),
    /reference_image_model_required/);
});
