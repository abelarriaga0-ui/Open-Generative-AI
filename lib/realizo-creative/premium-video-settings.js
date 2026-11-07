// Single source of truth for the video options chosen BEFORE Premium research.
// These choices are validated against the local Muapi model schema, stored in D1,
// and used for both customer quote and final generation without an editor.
import {videoModelCatalog} from '../../packages/studio/src/modelFamilies.js';
import {getVideoCommonOptions,getVideoCommonValues,buildVideoCommonPayload} from '../../packages/studio/src/videoModelParameters.js';
import {getModelMediaCapabilities} from '../../packages/studio/src/modelCapabilities.js';
import {buildVideoWorkflowMediaParams} from '../../packages/studio/src/videoWorkflows.js';
import {createModelParameterValues,buildSupplementalInputPayload} from '../../packages/studio/src/modelParameters.js';
import {normalizeLiveVideoInput} from '../wallet/live-video-models.js';

function modelFor(id){
 const model=videoModelCatalog.variantById.get(id)?.model;
 if(!model || model.hasPrompt===false || model.requiresRequestId)
  throw Error('invalid_video_configuration');
 return model;
}
const keys=[
 ['aspect_ratio','aspect_ratios','aspectRatio'],
 ['resolution','resolutions','resolution'],
 ['quality','qualities','quality'],
];
export function premiumVideoSettingsOptions(modelId,duration){
 const model=modelFor(modelId);
 const opts=getVideoCommonOptions(model,{duration});
 return {
  aspect_ratios:opts.aspectRatios||[],
  resolutions:opts.resolutions||[],
  qualities:opts.qualities||[],
 };
}
export function resolvePremiumVideoSettings(modelId,duration,requested={}){
 const model=modelFor(modelId);
 const opts=premiumVideoSettingsOptions(modelId,duration);
 const values=getVideoCommonValues(model,{duration});
 const settings={};
 for(const [field,option,jsKey] of keys){
  const allowed=opts[option];
  const asked=requested?.[field];
  if(asked!==undefined && asked!==null && asked!=='' &&
     !allowed.some(value=>String(value)===String(asked)))
    throw Error('invalid_video_configuration');
  const fallback=values[jsKey];
  const match=allowed.find(value=>String(value)===String(asked));
  const selected=match??fallback??allowed[0];
  if(selected!==undefined&&allowed.length)settings[field]=selected;
 }
 return settings;
}
export function buildPremiumGenerationParams({
 modelId,duration,settings={},prompt,imageUrl='',workflowId=null,imageRole='none'
}){
 const model=modelFor(modelId);
 if(typeof prompt!=='string'||!prompt.trim())throw Error('invalid_prompt');
 const resolved=resolvePremiumVideoSettings(modelId,duration,settings);
 const paramValues={
  aspectRatio:resolved.aspect_ratio,duration,
  resolution:resolved.resolution,quality:resolved.quality,
 };
 const media={};
 if(imageRole!=='none'){
  if(typeof imageUrl!=='string'||!/^https:\/\//.test(imageUrl))
   throw Error('invalid_media_reference');
  if(workflowId){
   const field=workflowId==='references'?'referenceImages':'startFrame';
   Object.assign(media,buildVideoWorkflowMediaParams(model,workflowId,{[field]:[imageUrl]}));
  }else{
   const image=getModelMediaCapabilities(model).image;
   if(!image.field)throw Error('invalid_video_configuration');
   media[image.field]=image.isArray?[imageUrl]:imageUrl;
  }
  if(!Object.keys(media).length)throw Error('invalid_video_configuration');
 }
 const parameterValues=createModelParameterValues(model);
 if(workflowId==='references'&&model.inputs?.omni_reference_task_type)
   parameterValues.omni_reference_task_type='reference';
 // Kling 4 keyframe routes require first_frame_url, never a generic alias.
 if(/^kling-4\.0(?:-flash)?-keyframe-to-video$/.test(modelId)){
  if(!imageUrl)throw Error('invalid_media_reference');
  media.first_frame_url=imageUrl;
  for(const key of ['image_url','images_list','image_urls'])delete media[key];
 }
 const supplemental=buildSupplementalInputPayload(model,parameterValues);
 const common=buildVideoCommonPayload(model,paramValues);
 // Duration is always specified for the immutable Premium wallet gate.
 const input={...supplemental,...common,...media,prompt:prompt.trim(),duration};
 return {
  model:modelId,
  ...normalizeLiveVideoInput(modelId,input),
 };
}
