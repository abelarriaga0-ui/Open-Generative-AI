// Dedicated Realizo template flow: one fixed Muapi generation contract.
// Unlike the free editor, customers cannot change model, duration or workflow.
import {
  buildLockedUgc30Prompt,UGC_MUAPI_30_MODEL,UGC_MUAPI_30_DURATION
} from './ugc-master-30.js';
export const TEMPLATE_UCG_ID='ugc-vendedor';
export const TEMPLATE_PREVIEW_SRC='/assets/realizo/templates/ugc-master-30s.mp4';
export const TEMPLATE_PREVIEW_PROVIDER_SRC='https://cdn.muapi.ai/outputs/generated/21797787-63de-48e3-b895-06396b1e55a9_07f12652.mp4';
export const TEMPLATE_MODEL_ID=UGC_MUAPI_30_MODEL;
const clean=(v,n)=>String(v??'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim().slice(0,n);
export function makeTemplateVideoInput({productName,description,spokenScript,buyerMotive='',angle='beneficio directo',products=[],imageUrl,changeRequest='',actor='hombre',setting='auto',market='EC'}={}){
  const name=clean(productName,100);
  const desc=clean(description,320);
  const speech=clean(spokenScript,650);
  if(!name||desc.length<15||!speech||!/^https:\/\//.test(imageUrl||''))throw Error('invalid_template_payload');
  const geometry=Array.isArray(products)?{
    products:products.slice(0,5).map(p=>({
      name:clean(p?.name,70),container_type:clean(p?.container_type,60),
      body_shape:clean(p?.body_shape,90),closure_type:clean(p?.closure_type,65),
      main_colors:clean(p?.main_colors,80)
    })).filter(p=>p.name),relative_pairs:[]
  }:null;
  const prompt=buildLockedUgc30Prompt({
    duration:UGC_MUAPI_30_DURATION,product:name,sellerDescription:desc,
    voice:speech,market,angle:clean(angle,120),
    buyerMotive:clean(buyerMotive,230),productGeometry:geometry,
    templateActor:actor,templateSetting:setting,templateChangeRequest:changeRequest,
  });
  // EXACT shape from the successful Muapi prediction (the reference photo is
  // the NEW uploaded product; there is no input video or input audio).
  return {
    model_id:TEMPLATE_MODEL_ID,
    input:{
      duration:30,aspect_ratio:'9:16',seed:null,high_bitrate:false,prompt,
      images_list:[imageUrl],videos_list:null,audios_list:null,
      omni_reference_task_type:'reference',resolution:'720p',
      draft:false,draft_request_id:null,
    }
  };
}
