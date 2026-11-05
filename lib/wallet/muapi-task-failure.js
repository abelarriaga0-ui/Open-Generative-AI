// Muapi task results are untrusted external objects. Classify a failure without
// returning raw provider errors, prompts, file URLs or account identifiers.
function failureStrings(value,parts,depth=0){
 if(parts.length>=40||depth>3||value==null)return;
 if(typeof value==='string'){
  parts.push(value.slice(0,1200));
  return;
 }
 if(Array.isArray(value)){
  for(const item of value.slice(0,6))failureStrings(item,parts,depth+1);
  return;
 }
 if(typeof value==='object'){
  for(const name of ['code','type','message','reason','error','detail','details','failure_reason','fail_reason','status_message','status_reason']){
   if(Object.hasOwn(value,name))failureStrings(value[name],parts,depth+1);
  }
 }
}
export function classifyMuapiTaskFailure(result){
 const parts=[];
 failureStrings(result,parts);
 const details=parts.join(' ').toLowerCase().slice(0,3500);
 if(/content[ -]?policy|safety|moderation|nsfw|prohibited|blocked[ _-]?content|censorship/.test(details))
  return 'generation_content_rejected';
 if(/rate[ -]?limit|too many requests|queue full|concurrency|overload|capacity|busy|429/.test(details))
  return 'generation_service_busy';
 if(/insufficient (balance|funds|credits)|not enough credits|billing|payment required|402/.test(details))
  return 'generation_service_balance_unavailable';
 if(/prompt.{0,35}(too long|invalid|exceed|limit|tokens|length)|text.{0,30}(too long|exceed|limit)/.test(details))
  return 'generation_prompt_invalid';
 if(/image|reference|fetch.{0,20}(url|file)|invalid url|expired url|download.{0,20}(fail|error)|media file/.test(details))
  return 'generation_image_reference_invalid';
 if(/duration|invalid seconds|video length/.test(details))
  return 'generation_duration_invalid';
 if(/resolution|aspect_ratio|aspect ratio|unsupported quality|video quality/.test(details))
  return 'generation_quality_invalid';
 if(/model.{0,25}(not found|unavailable|unsupported)|no such model|model_not_found/.test(details))
  return 'generation_model_unavailable';
 if(/timeout|timed out|internal server|worker crashed|failed inference|gpu|upstream|server error/.test(details))
  return 'generation_service_unavailable';
 return 'provider_failed';
}
// This is the only public failure-information contract. It cannot leak
// arbitrary provider data; customer jobs continue to be user-scoped.
export const PUBLIC_MUAPI_FAILURE_CODES=Object.freeze([
 'provider_failed','generation_content_rejected','generation_service_busy',
 'generation_service_balance_unavailable','generation_prompt_invalid',
 'generation_image_reference_invalid','generation_duration_invalid',
 'generation_quality_invalid','generation_model_unavailable',
 'generation_service_unavailable',
]);
export function safeStoredMuapiFailureCode(value){
 return PUBLIC_MUAPI_FAILURE_CODES.includes(value)?value:'provider_failed';
}
