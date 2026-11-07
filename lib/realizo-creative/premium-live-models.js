// Muapi video catalog snapshots are refreshed by a daily scheduled workflow.
// Customers read a D1 snapshot, never query Muapi while filling the form.
// Only schema-validated public models are made selectable. Real paid prices
// and provider POST routes are still verified by the wallet/generation server.
import {premiumVideoOptions,resolvePremiumVideoChoice} from './video-specs.js';
const MODEL_ID=/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const MEDIA=['image_urls','images_list','reference_images','image_url','first_frame_url','start_image_url','first_image_url'];
const REQUIRED=new Set([...MEDIA,'prompt','duration','resolution','quality','aspect_ratio']);
let cache=null,expiry=0;
const SNAPSHOT_TTL_MS=15*60*1000;
const SAFE_VIDEO_FIELDS=['id','name','family','family_id','provider','provider_name',
 'variant_label','model_origin','mode','workflow_id','image_role','media_field',
 'media_is_array','durations','prompt_max_length','aspect_ratios','resolutions',
 'qualities','note'];
const string=(x,max=150)=>typeof x==='string'?x.trim().slice(0,max):'';
function schemaFields(record){
 const schema=record?.input_schema||record?.inputSchema||record?.schema||record?.inputs||record?.input_fields;
 if(!schema||typeof schema!=='object'||Array.isArray(schema)&&schema.length>80)return null;
 const raw=schema.properties||schema.inputs||schema;
 if(Array.isArray(raw)){
  return Object.fromEntries(raw.filter(x=>x&&typeof x==='object'&&typeof x.name==='string')
    .map(x=>[x.name,x]));
 }
 return raw && typeof raw==='object'&&!Array.isArray(raw)?raw:null;
}
function specValues(field){
 if(!field||typeof field!=='object')return [];
 const options=field.enum||field.options||field.values||field.allowed_values;
 if(!Array.isArray(options))return [];
 return options.filter(x=>typeof x==='string'||typeof x==='number').slice(0,40);
}
function durations(field,record){
 const listed=specValues(field).map(Number).filter(x=>Number.isInteger(x)&&x>=1&&x<=120);
 if(listed.length)return [...new Set(listed)].sort((a,b)=>a-b);
 const low=Number(field?.minValue??field?.minimum??record.min_duration);
 const high=Number(field?.maxValue??field?.maximum??record.max_duration);
 const step=Number(field?.step||field?.multipleOf||1);
 if(Number.isInteger(low)&&Number.isInteger(high)&&low>0&&high<=120&&
    high>=low&&step===1)return Array.from({length:high-low+1},(_,i)=>i+low);
 return [];
}
const normalizeName=id=>id.split('-').filter(Boolean).slice(0,3).map(s=>
 /^[0-9]+(?:\.[0-9]+)?$/.test(s)?s:s.charAt(0).toUpperCase()+s.slice(1)).join(' ');
function familyOf(id,record){
 const known=[['kling','Kling AI'],['seedance','ByteDance'],['veo','Google'],['google','Google'],
  ['wan','Alibaba'],['minimax','MINIMAX'],['hailuo','MINIMAX'],['pixverse','Pixverse'],
  ['vidu','Vidu'],['runway','RunwayML'],['sora','OpenAI'],['grok','xAI'],
  ['ltx','Lightricks'],['flux','Black Forest Labs']];
 const provider=string(record.provider,45).toLowerCase()||
  (known.find(([name])=>id.includes(name))||[])[0]||'muapi';
 const providerName=string(record.provider_name,65)||
  known.find(([name])=>provider.includes(name))?.[1]||
  (provider==='muapi'?'Muapi':normalizeName(provider));
 let family=string(record.family,65)||string(record.group_name,65);
 if(!family||/^(video|image to video|text to video)$/i.test(family)){
  const version=id.match(/(?:kling|seedance|wan|veo|pixverse|vidu|hailuo|grok|runway)[-_]?(?:v)?(\d+(?:\.\d+)?)/);
  family=version?providerName.split(' ')[0]+' '+version[1]:providerName;
 }
 return {provider,providerName,family,familyId:provider+'-'+family.toLowerCase().replace(/[^a-z0-9]+/g,'-')};
}
export function liveVideoOptionFromRecord(record,existingIds=new Set()){
 if(!record||typeof record!=='object'||Array.isArray(record))return null;
 const id=string(record.name||record.id,100).toLowerCase();
 if(!MODEL_ID.test(id)||existingIds.has(id)||record.is_enabled===false||record.is_enabled===0||
   record.is_coming_soon===true||record.is_coming_soon===1)return null;
 const category=string(record.category,100)+' '+string(record.group_of,100);
 if(!/(?:text|image)\s*(?:to|-to-|2)\s*video/i.test(category) &&
   !/(?:text-to-video|image-to-video|reference-to-video|keyframe-to-video)$/i.test(id))return null;
 if(/(?:video-edit|motion-control|video-to-video)/i.test(id))return null;
 const schema=record.input_schema||record.inputSchema||record.schema||{};
 const fields=schemaFields(record);
 if(!fields||Object.keys(fields).length>65||!fields.prompt)return null;
 const required=Array.isArray(schema.required)?schema.required:
   Array.isArray(record.required)?record.required:[];
 if(required.some(x=>!REQUIRED.has(x)))return null;
 const media=MEDIA.find(name=>fields[name]);
 const isArray=Boolean(media&&
  (fields[media]?.type==='array'||/s$|_list$/.test(media)));
 const mode=media?'i2v':'t2v';
 // A route with an image reference must explicitly declare its image field.
 if(mode==='i2v'&&!media)return null;
 const span=durations(fields.duration,record);
 if(!span.length)return null; // No fabricated duration choices.
 const ratios=specValues(fields.aspect_ratio).map(String);
 const resolutions=specValues(fields.resolution).map(String);
 const qualities=specValues(fields.quality).map(String);
 const isReference=Boolean(media&&isArray&&/reference|omni/i.test(id));
 const role=mode==='t2v'?'none':isReference?'product_reference':'start_frame';
 const family=familyOf(id,record);
 const settings={
  aspect_ratios:ratios,resolutions,qualities,
 };
 const limit=Number(fields.prompt.maxLength??fields.prompt.max_length??8000);
 const promptLimit=Number.isInteger(limit)&&limit>=1200&&limit<=20000?limit:8000;
 return {
  id,name:string(record.display_name||record.title,110)||normalizeName(id),family:family.family,
  family_id:family.familyId,provider:family.provider,provider_name:family.providerName,
  variant_label:string(record.display_name||record.title,110)||id,
  model_origin:'muapi_live',mode,workflow_id:role==='product_reference'?'references':
    role==='start_frame'?'animate_image':null,
  image_role:role,media_field:media||null,media_is_array:isArray,
  durations:span,prompt_max_length:promptLimit,
  ...settings,settings_by_duration:Object.fromEntries(span.map(d=>[d,settings])),
  note:role==='product_reference'?'La fotografía se usa como referencia visual, no como primer fotograma.':
    role==='start_frame'?'La fotografía se usa como fotograma inicial.':
    'Generación desde texto; no admite fotografía del producto.',
 };
}
// Called ONLY from a scheduled maintenance job, never from a customer request.
// Serialize a compact, strictly public schema; exclude pricing and API keys.
export function createPublishedVideoCatalog(records,refreshedAt=new Date().toISOString()){
 if(!Array.isArray(records)||records.length<1||records.length>3000)
  throw Error('invalid_provider_catalog');
 const seen=new Set(premiumVideoOptions().map(o=>o.id));
 const options=[];
 for(const record of records){
  const option=liveVideoOptionFromRecord(record,seen);
  if(!option)continue;
  seen.add(option.id);
  options.push(Object.fromEntries(SAFE_VIDEO_FIELDS.map(key=>[key,option[key]])));
 }
 // A provider outage or changed schema must NOT overwrite last good snapshot.
 if(!options.length||options.length>350)throw Error('no_compatible_live_models');
 const snapshot={refreshed_at:refreshedAt,options};
 if(JSON.stringify(snapshot).length>300000)throw Error('catalog_snapshot_too_large');
 return snapshot;
}
function fromPublishedOption(o){
 if(!o||typeof o!=='object'||Array.isArray(o)||!MODEL_ID.test(o.id||'')||
    o.id.length>100||o.model_origin!=='muapi_live'||
    !['i2v','t2v'].includes(o.mode)||
    !['product_reference','start_frame','none'].includes(o.image_role)||
    !(o.media_field===null||MEDIA.includes(o.media_field))||
    !Number.isInteger(o.prompt_max_length)||
    o.prompt_max_length<1200||o.prompt_max_length>20000||
    !Array.isArray(o.durations)||o.durations.length>120||!o.durations.length||
    o.durations.some(d=>!Number.isInteger(d)||d<1||d>120))return null;
 const strings=['id','name','family','family_id','provider','provider_name','variant_label','note'];
 if(strings.some(k=>typeof o[k]!=='string'||o[k].length>200))return null;
 if(!['aspect_ratios','resolutions','qualities'].every(k=>Array.isArray(o[k])&&
   o[k].length<=40&&o[k].every(v=>typeof v==='string'&&v.length<=30)))return null;
 if(o.mode==='i2v'&&!o.media_field||o.mode==='t2v'&&o.media_field)return null;
 const settings={aspect_ratios:o.aspect_ratios,resolutions:o.resolutions,qualities:o.qualities};
 return {...o,...settings,
  settings_by_duration:Object.fromEntries(o.durations.map(seconds=>[seconds,settings]))};
}
// Only D1 is read in live web requests; no provider fetch, even for a cold
// Cloudflare Worker isolate. Missing migration or stale snapshot falls back to
// the known bundled models without interrupting checkout.
export async function allPremiumVideoOptions(db=null){
 const base=premiumVideoOptions();
 if(!db?.prepare)return base;
 if(cache&&Date.now()<expiry)return cache;
 try{
  const row=await db.prepare("SELECT snapshot_json FROM realizo_muapi_video_catalog WHERE id='active'").first();
  const data=JSON.parse(row?.snapshot_json||'null');
  if(!data||!Array.isArray(data.options)||data.options.length>350)
   throw Error('catalog_snapshot_missing');
  const seen=new Set(base.map(o=>o.id));
  const extra=[];
  for(const record of data.options){
   const option=fromPublishedOption(record);
   if(!option||seen.has(option.id))continue;
   seen.add(option.id);extra.push(option);
  }
  cache=Object.freeze([...base,...extra].sort((a,b)=>
   a.provider_name.localeCompare(b.provider_name)||a.family.localeCompare(b.family)||
   a.name.localeCompare(b.name)));
  expiry=Date.now()+SNAPSHOT_TTL_MS;
 }catch{
  cache=base;expiry=Date.now()+60*1000;
 }
 return cache;
}
export async function resolveAnyPremiumVideoChoice(modelId,duration,db=null){
 const list=await allPremiumVideoOptions(db);
 const option=list.find(x=>x.id===modelId);
 const d=Number(duration);
 if(!option||!Number.isInteger(d)||!option.durations.includes(d))
  throw Error('invalid_video_configuration');
 if(option.model_origin!=='muapi_live')return {...resolvePremiumVideoChoice(modelId,d),option};
 return {modelId:option.id,duration:d,workflowId:option.workflow_id,
  imageRole:option.image_role,option};
}
export function liveVideoSettingsForChoice(option,requested={}){
 const settings={};
 for(const [input,property] of [['aspect_ratio','aspect_ratios'],['resolution','resolutions'],['quality','qualities']]){
  const values=option[property]||[];
  const specified=requested[input];
  if(specified!==undefined&&specified!==null&&specified!==''&&!values.some(x=>String(x)===String(specified)))
   throw Error('invalid_video_configuration');
  if(values.length)settings[input]=values.find(x=>String(x)===String(specified))??values[0];
 }
 return settings;
}
export function buildLivePremiumVideoInput(option,{modelId,duration,settings={},prompt,imageUrl=''}={}){
 if(!option||option.model_origin!=='muapi_live'||option.id!==modelId||
   !option.durations.includes(Number(duration))||typeof prompt!=='string'||
   !prompt.trim()||prompt.length>option.prompt_max_length)throw Error('invalid_video_configuration');
 const params=liveVideoSettingsForChoice(option,settings);
 const input={prompt:prompt.trim(),duration:Number(duration),...params};
 if(option.media_field){
  if(!/^https:\/\//.test(imageUrl))throw Error('invalid_media_reference');
  input[option.media_field]=option.media_is_array?[imageUrl]:imageUrl;
 }
 return {model:modelId,...input};
}
