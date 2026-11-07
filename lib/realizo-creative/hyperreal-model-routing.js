// Hiperrealista PRO: one display name per model VERSION, never per provider workflow.
// Only this isolated module uses this selector; the advanced studio remains unchanged.
export const KLING_40_FAMILY = 'realizo-kling-4.0';
export const KLING_40_REFERENCE = 'kling-4.0-reference-to-video';
export const KLING_40_TEXT = 'kling-4.0-text-to-video';
const KLING_DURATIONS = [15,30];

function variantScore(v, hasImage) {
  const id=String(v.id||'').toLowerCase();
  const role=v.image_role;
  if(hasImage && (role!=='product_reference'||v.mode!=='i2v'))return -1000;
  if(!hasImage && (role!=='none'||v.mode!=='t2v'))return -1000;
  return 100
    + (/intl/.test(id)?25:0)
    + (/omni-reference|reference-to-video/.test(id)?20:0)
    + (/1080p/.test(id)?5:0)
    - (/spicy|mini|lite/.test(id)?60:0)
    - (/4k/.test(id)?10:0)
    - (/flash|fast/.test(id)?6:0);
}
export function hyperrealModelFamilies(videoOptions=[]) {
  const byFamily=new Map();
  for(const model of videoOptions){
    if(!model?.id||!model?.family_id||!['none','product_reference'].includes(model.image_role))continue;
    if(!Array.isArray(model.durations)||!model.durations.length)continue;
    const id=String(model.family_id);
    if(!byFamily.has(id))byFamily.set(id,{id,label:String(model.family||id),variants:[]});
    byFamily.get(id).variants.push(model);
  }
  byFamily.set(KLING_40_FAMILY,{
    id:KLING_40_FAMILY,label:'Kling 4.0',
    variants:[
      {id:KLING_40_REFERENCE,image_role:'product_reference',mode:'i2v',durations:KLING_DURATIONS},
      {id:KLING_40_TEXT,image_role:'none',mode:'t2v',durations:KLING_DURATIONS}
    ]
  });
  return [...byFamily.values()].map(group=>({
    id:group.id,label:group.label,
    durations:[...new Set(group.variants.flatMap(m=>m.durations||[]))].sort((a,b)=>a-b),
    supports_photo:group.variants.some(v=>v.image_role==='product_reference'),
    supports_text:group.variants.some(v=>v.image_role==='none'),
    variants:group.variants
  })).sort((a,b)=>{
    const order=id=>id===KLING_40_FAMILY?0:id==='seedance-2.5'?1:id.startsWith('veo-')?2:3;
    return order(a.id)-order(b.id)||a.label.localeCompare(b.label,'es');
  });
}
export function resolveHyperrealModelFamily(videoOptions,familyId,duration,{hasImage=false}={}){
  const seconds=Number(duration);
  if(!Number.isSafeInteger(seconds)||seconds<1||seconds>120)
    throw Error('invalid_video_configuration');
  const family=hyperrealModelFamilies(videoOptions).find(f=>f.id===familyId);
  if(!family)throw Error('invalid_video_configuration');
  const selected=family.variants
    .filter(m=>Array.isArray(m.durations)&&m.durations.includes(seconds))
    .map(v=>({v,score:variantScore(v,hasImage)}))
    .filter(x=>x.score>=0)
    .sort((a,b)=>b.score-a.score||String(a.v.id).localeCompare(String(b.v.id)))[0]?.v;
  if(!selected)throw Error(hasImage?'reference_image_model_required':'text_video_model_required');
  if(family.id===KLING_40_FAMILY){
    return {
      modelId:selected.id, imageRole:hasImage?'product_reference':'none',
      workflowId:hasImage?'references':null, duration:seconds, familyId:family.id,
      nativeKling4:true
    };
  }
  return {
    modelId:selected.id,imageRole:selected.image_role,
    workflowId:selected.workflow_id||null,duration:seconds,familyId:family.id,nativeKling4:false
  };
}
export function buildKling40HyperrealParams({choice,prompt,imageUrl,aspectRatio}){
  if(!choice?.nativeKling4||!KLING_DURATIONS.includes(choice.duration))
    throw Error('invalid_video_configuration');
  if(!['16:9','9:16'].includes(aspectRatio))throw Error('invalid_video_configuration');
  const withImage=choice.imageRole==='product_reference';
  if(withImage && (typeof imageUrl!=='string'||!/^https:\/\//.test(imageUrl)))
    throw Error('invalid_media_reference');
  const input={
    prompt:(withImage?'@image_1 is the real product identity reference, NEVER the first frame. ':'')+prompt,
    duration:choice.duration,resolution:'1080p',aspect_ratio:aspectRatio
  };
  if(withImage)input.image_urls=[imageUrl];
  return {model:choice.modelId,...input};
}
