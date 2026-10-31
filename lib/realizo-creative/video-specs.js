// Read-only catalog shared by the pre-research form and server validation.
// No provider call is made while choosing a model or a duration.
import {videoModelCatalog} from '../../packages/studio/src/modelFamilies.js';
import {getVideoCommonOptions} from '../../packages/studio/src/videoModelParameters.js';
import {getModelMediaCapabilities} from '../../packages/studio/src/modelCapabilities.js';
import {getVideoWorkflowFamily} from '../../packages/studio/src/videoWorkflows.js';
import {videoEngineCapabilities} from './sales-director.js';

let cached = null;
export function premiumVideoOptions(){
 if(cached)return cached;
 const options=[];
 for(const [id,variant] of videoModelCatalog.variantById){
  if(!variant?.model || !['i2v','t2v'].includes(variant.mode))continue;
  if(variant.model.requiresRequestId || variant.model.hasPrompt===false)continue;
  if(variant.mode==='i2v' && getModelMediaCapabilities(variant.model).image.maxItems<1)continue;
  const durations=[...new Set((getVideoCommonOptions(variant.model).durations||[])
   .map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=120))].sort((a,b)=>a-b);
  if(!durations.length)continue; // Never imply a duration the provider did not declare.
  const family=videoModelCatalog.familyByVariantId.get(id);
  const workflows=getVideoWorkflowFamily(family?.id)?.workflowById;
  const matching=idToCheck=>workflows?.get(idToCheck)?.variants?.some(v=>v.model?.id===id);
  const workflowId=matching('references')?'references':
   matching('animate_image')?'animate_image':null;
  const capability=videoEngineCapabilities(id,workflowId);
  const imageRole=variant.mode==='t2v'?'none':capability.imageRole;
  options.push({
   id,name:variant.model.name||id,family:family?.name||'Otros',
   family_id:family?.id||id,
   provider:family?.provider||'muapi',
   provider_name:family?.provider_name||'Otros',
   variant_label:(variant.model.name||id).replace(new RegExp('^'+
     (family?.name||'').replace(/[.*+?^${}()|[\]\\]/g,'\\   id,name:variant.model.name||id,family:family?.name||'Otros',')+'\\s*','i'),'').trim()||'Estándar',
   mode:variant.mode,workflow_id:workflowId,durations,image_role:imageRole,
   note:imageRole==='product_reference'?'La foto se utiliza como referencia visual.':
    imageRole==='start_frame'?'Este motor anima la foto como fotograma inicial.':
    'Este motor no acepta una fotografía del producto como referencia.',
  });
 }
 cached=Object.freeze(options.sort((a,b)=>
  (a.image_role==='product_reference'?0:1)-(b.image_role==='product_reference'?0:1)
  || a.family.localeCompare(b.family)||a.name.localeCompare(b.name)));
 return cached;
}
export function resolvePremiumVideoChoice(modelId,duration){
 const option=premiumVideoOptions().find(o=>o.id===modelId);
 const seconds=Number(duration);
 if(!option || !Number.isInteger(seconds) || !option.durations.includes(seconds))
  throw Error('invalid_video_configuration');
 return {modelId:option.id,duration:seconds,workflowId:option.workflow_id,imageRole:option.image_role};
}
