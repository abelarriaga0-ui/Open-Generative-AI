// Realizo Hiperrealista PRO: durable GitHub Actions processor.
// Only scans realizo_hyperreal_pro_jobs and its own video-chunk table.
// All AI/model submissions occur strictly AFTER an existing D1 wallet reserve.
import {createWriteStream,readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {
 HYPERREAL_CHUNK_BYTES,HYPERREAL_IMAGE_MODEL,HYPERREAL_VIDEO_MODEL,
 buildHyperrealDirectorRequest,parseHyperrealDirectorResult,
 masterImageInput,sceneImageInput,sceneVideoInput
} from '../lib/realizo-creative/hyperreal-production.js';
import {HyperrealD1,sqlValue} from './hyperreal-pro-db.mjs';

const env=process.env;
const cloudflare=env.CLOUDFLARE_API_TOKEN;
const muapi=env.REALIZO_MUAPI_API_KEY;
const openai=env.REALIZO_OPENAI_API_KEY;
if(!cloudflare||!muapi||!openai)throw Error('hyperreal_protected_credentials_unavailable');
const db=new HyperrealD1(cloudflare);
const API='https://api.muapi.ai/api/v1';
const OUTPUT_CAP=80*1024*1024;
const KNOWN_PROVIDER_HOST=/(^|\.)muapi\.ai$|(^|\.)cloudfront\.net$|(^|\.)amazonaws\.com$|(^|\.)googleapis\.com$|(^|\.)r2\.dev$/i;
const parseJson=s=>{try{return JSON.parse(s||'{}');}catch{throw Error('hyperreal_stored_json_invalid');}};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ACCEPTED_STATES=new Set(['queued','pending','processing','starting','in_progress']);
const safeUrl=input=>{
 let u;try{u=new URL(input);}catch{throw Error('hyperreal_output_url_invalid');}
 if(u.protocol!=='https:'||u.username||u.password||
    !KNOWN_PROVIDER_HOST.test(u.hostname))throw Error('hyperreal_output_host_unrecognized');
 return u.href;
};
class Review extends Error{constructor(c){super(c);this.name='Review';}}
class Failure extends Error{constructor(c){super(c);this.name='Failure';}}

function assertResponseId(value,type){
 if(type==='openai'){
  if(!/^resp_[a-zA-Z0-9_-]{8,}$/.test(value||''))throw new Review('openai_submit_response_unknown');
 }else if(typeof value!=='string'||!value||value.length>250||
    !/^[a-zA-Z0-9_-]+$/.test(value))
  throw new Review('muapi_submit_response_unknown');
 return value;
}
async function providerPost(type,model,payload){
 const url=type==='openai'?'https://api.openai.com/v1/responses':API+'/'+model;
 let response;
 try{
  response=await fetch(url,{
   method:'POST',
   headers:type==='openai'?
     {Authorization:'Bearer '+openai,'Content-Type':'application/json'}:
     {'x-api-key':muapi,'Content-Type':'application/json'},
   body:JSON.stringify(payload),signal:AbortSignal.timeout(35000)
  });
 }catch{throw new Review(type+'_submit_ambiguous');}
 if(response.status>=400&&response.status<500){
  // Definitive provider rejection, no returned request ID.
  throw new Failure(type+'_submit_rejected_'+response.status);
 }
 if(!response.ok)throw new Review(type+'_submit_ambiguous');
 let result;
 try{result=await response.json();}
 catch{throw new Review(type+'_submit_ambiguous');}
 return assertResponseId(result.id||result.request_id,type);
}
async function providerGet(type,id){
 const url=type==='openai'?
  'https://api.openai.com/v1/responses/'+encodeURIComponent(id):
  API+'/predictions/'+encodeURIComponent(id)+'/result';
 const response=await fetch(url,{method:'GET',
  headers:type==='openai'?{Authorization:'Bearer '+openai}:{'x-api-key':muapi},
  signal:AbortSignal.timeout(25000)
 });
 if(!response.ok){
  if(response.status===404||response.status===410)throw new Review(type+'_provider_request_missing');
  throw Error(type+'_provider_poll_transient');
 }
 return response.json();
}
function outputFromProvider(data){
 const source=Array.isArray(data?.outputs)?data.outputs[0]:
  data?.output?.url||data?.output?.video_url||
  data?.output?.image_url||data?.url||data?.video_url||data?.image_url;
 const url=typeof source==='string'?source:source?.url;
 return safeUrl(url);
}
async function checkpoint(job,progress,stage){
 await db.update(job,stage,progress);
}
async function runProviderStep(job,progress,{key,type,model,payload,stage}){
 if(progress.done?.[key])return progress.done[key];
 if(!progress.done)progress.done={};
 let pending=progress.pending;
 if(pending && pending.key!==key)
  throw new Review('provider_step_order_conflict');
 if(pending&&pending.key===key&&!pending.id)
  throw new Review('provider_submission_without_id');
 if(!pending){
  // Record durable intent BEFORE provider spending; network ambiguity is not retried.
  progress.pending={key,type,model,id:null,started:new Date().toISOString()};
  await checkpoint(job,progress,stage);
  const id=await providerPost(type,model,payload);
  progress.pending.id=id;
  await checkpoint(job,progress,stage);
  pending=progress.pending;
 }
 const deadline=Date.now()+9*60*1000;
 let failures=0;
 while(Date.now()<deadline){
  let result;
  try{
   result=await providerGet(type,pending.id);
   failures=0;
  }catch(e){
   if(e instanceof Review)throw e;
   failures++;
   if(failures>=8)break;
   await wait(6000);continue;
  }
  const status=String(result?.status||result?.state||'').toLowerCase();
  if(status==='completed'||status==='succeeded'||status==='success'){
   const value=type==='openai'?result:outputFromProvider(result);
   progress.done[key]=value;
   progress.pending=null;
   await checkpoint(job,progress,stage);
   return value;
  }
  if(['failed','cancelled','canceled','expired','error'].includes(status))
   throw new Failure(type+'_job_failed');
  if(status&&!ACCEPTED_STATES.has(status))
   throw new Review(type+'_provider_unknown_state');
  await wait(8500);
  // Update the lease while polling, but do not create new paid requests.
  await checkpoint(job,progress,stage);
 }
 // Keep the saved provider id. Another scheduled run can resume polling
 // without generating anything twice.
 await db.unlock(job,progress);
 return null;
}
async function fetchProviderVideo(url,file,maxBytes){
 let current=safeUrl(url),r;
 for(let n=0;n<5;n++){
  r=await fetch(current,{redirect:'manual',headers:{Accept:'video/mp4,*/*'},
   signal:AbortSignal.timeout(120000)});
  if([301,302,303,307,308].includes(r.status)){
   const location=r.headers.get('location');
   if(!location)throw new Failure('video_redirect_unavailable');
   current=safeUrl(new URL(location,current).href);
   continue;
  }
  break;
 }
 if(!r?.ok||!r.body)throw new Failure('provider_clip_unavailable');
 const len=Number(r.headers.get('content-length')||0);
 if(len>maxBytes)throw new Failure('provider_clip_too_large');
 const type=String(r.headers.get('content-type')||'');
 if(/application\/json|text\/html/i.test(type))throw new Failure('provider_clip_invalid');
 let bytes=0;
 const limiter=new TransformStream({transform(chunk,controller){
  bytes+=chunk.byteLength;
  if(bytes>maxBytes)throw Error('clip_download_over_limit');
  controller.enqueue(chunk);
 }});
 try{await pipeline(Readable.fromWeb(r.body.pipeThrough(limiter)),createWriteStream(file));}
 catch{throw new Failure('provider_clip_download_failed');}
 if(bytes<5000)throw new Failure('provider_clip_empty');
}
function exec(bin,args){
 const r=spawnSync(bin,args,{encoding:'utf8',maxBuffer:1024*1024,timeout:300000});
 if(r.error||r.status!==0)throw new Failure('video_montage_failed');
 return r.stdout||'';
}
function probe(file){
 const raw=exec('ffprobe',['-v','error','-show_entries',
  'stream=codec_type:format=duration','-of','json',file]);
 let info;try{info=JSON.parse(raw);}catch{throw new Failure('video_probe_failed');}
 const duration=Number(info.format?.duration);
 if(!Number.isFinite(duration)||duration<2.5||duration>35)
  throw new Failure('provider_clip_duration_invalid');
 return {duration,video:(info.streams||[]).some(s=>s.codec_type==='video'),
  audio:(info.streams||[]).some(s=>s.codec_type==='audio')};
}
async function render(job,brief,progress,clips,plan){
 const dir=await mkdtemp(join(tmpdir(),'realizo-hyperreal-'));
 const files=[];
 let expected=0;
 for(let i=0;i<clips.length;i++){
  const file=join(dir,'clip-'+i+'.mp4');
  await fetchProviderVideo(clips[i],file,OUTPUT_CAP);
  const meta=probe(file);
  if(!meta.video)throw new Failure('provider_video_stream_missing');
  if(brief.audio_mode!=='none'&&!meta.audio)
   throw new Failure('scene_speech_audio_missing');
  if(Math.abs(meta.duration-plan[i].seconds)>2)
   throw new Failure('scene_duration_not_respected');
  expected+=plan[i].seconds;
  files.push(file);
 }
 const vertical=brief.aspect_ratio==='9:16';
 const width=vertical?1080:1920,height=vertical?1920:1080;
 const withAudio=brief.audio_mode!=='none';
 const inputs=files.flatMap(file=>['-i',file]);
 const filters=[];
 for(let i=0;i<files.length;i++){
  filters.push('['+i+':v]fps=30,scale='+width+':'+height+
   ':force_original_aspect_ratio=increase,crop='+width+':'+height+
   ',setsar=1,format=yuv420p,setpts=PTS-STARTPTS[v'+i+']');
  if(withAudio)filters.push('['+i+':a]aresample=async=1:first_pts=0,asetpts=PTS-STARTPTS[a'+i+']');
 }
 const streams=files.map((_,i)=>'[v'+i+']'+(withAudio?'[a'+i+']':'')).join('');
 filters.push(streams+'concat=n='+files.length+':v=1:a='+(withAudio?'1':'0')+
  '[outv]'+(withAudio?'[outa]':''));
 const out=join(dir,'realizo-hyperreal-final.mp4');
 const args=['-y','-hide_banner','-loglevel','error',...inputs,
  '-filter_complex',filters.join(';'),'-map','[outv]',
  ...(withAudio?['-map','[outa]','-c:a','aac','-b:a','128k']:['-an']),
  '-c:v','libx264','-preset','veryfast','-crf','26',
  '-pix_fmt','yuv420p','-movflags','+faststart','-r','30',out];
 exec('ffmpeg',args);
 const result=probe(out);
 if(Math.abs(result.duration-expected)>1.8)
  throw new Failure('montage_length_not_accurate');
 if(withAudio){
  const r=spawnSync('ffmpeg',['-hide_banner','-i',out,'-af',
    'silencedetect=noise=-50dB:d=2','-f','null','-'],{
     encoding:'utf8',maxBuffer:200000,timeout:90000});
  if(r.status!==0)throw new Failure('montage_audio_not_readable');
  if(/silence_duration:\s*(?:[3-9]|[1-9]\d)/.test(r.stderr||''))
   throw new Failure('montage_long_silent_gap');
 }
 const size=statSync(out).size;
 if(size>OUTPUT_CAP||size<10000)throw new Failure('montage_output_size_invalid');
 const bytes=readFileSync(out),sha=createHash('sha256').update(bytes).digest('hex');
 const chunks=Math.ceil(bytes.length/HYPERREAL_CHUNK_BYTES);
 for(let i=0;i<chunks;i++){
  await db.putChunk(job,i,bytes.subarray(
   i*HYPERREAL_CHUNK_BYTES,Math.min((i+1)*HYPERREAL_CHUNK_BYTES,bytes.length)));
  if((i+1)%5===0){
   progress.uploaded_chunks=i+1;
   await checkpoint(job,progress,'montage');
  }
 }
 progress.uploaded_chunks=chunks;
 await db.finish(job,bytes.length,sha,progress,chunks);
 console.log('HYPERREAL_COMPLETED job='+job.id+' scenes='+clips.length+
  ' frames='+progress.images.length+' rendered_bytes='+bytes.length);
}
async function execute(job){
 const brief=parseJson(job.customer_brief_json),
  plan=JSON.parse(job.plan_json||'[]');
 const progress=parseJson(job.progress_json);
 progress.images=Array.isArray(progress.images)?progress.images:[];
 progress.videos=Array.isArray(progress.videos)?progress.videos:[];
 progress.done=progress.done||{};
 try{
  let research=null;
  if(!progress.story){
   research=await runProviderStep(job,progress,{
    key:'research',type:'openai',model:'responses',
    payload:buildHyperrealDirectorRequest({OPENAI_PREMIUM_MODEL:'gpt-6-luna'},brief),
    stage:'research'
   });
   if(!research)return;
   progress.story=parseHyperrealDirectorResult(research,brief);
   // The original owner photograph can support brand identity. If the
   // AI cannot identify the product, do NOT invent conversion claims.
   if(progress.story.identity_confidence==='unverified'&&!brief.description)
    throw new Failure('product_identity_needs_description');
   delete progress.done.research; // Do not persist full bulky provider raw response.
   progress.research_complete=true;
   await checkpoint(job,progress,'research');
  }
  const story=progress.story;
  const master=await runProviderStep(job,progress,{
   key:'image_master',type:'muapi',model:HYPERREAL_IMAGE_MODEL,
   payload:masterImageInput(brief,story),stage:'image_master'
  });
  if(!master)return;
  progress.images[0]=master;
  await checkpoint(job,progress,'image_master');
  for(let i=0;i<plan.length;i++){
   const key='scene_image_'+i;
   const url=await runProviderStep(job,progress,{
    key,type:'muapi',model:HYPERREAL_IMAGE_MODEL,
    payload:sceneImageInput(brief,story,story.scenes[i],master),
    stage:'scene_images'
   });
   if(!url)return;
   progress.images[i+1]=url;
   await checkpoint(job,progress,'scene_images');
  }
  for(let i=0;i<plan.length;i++){
   const key='scene_video_'+i;
   const url=await runProviderStep(job,progress,{
    key,type:'muapi',model:HYPERREAL_VIDEO_MODEL,
    payload:sceneVideoInput(brief,story,story.scenes[i],progress.images[i+1],master),
    stage:'scene_videos'
   });
   if(!url)return;
   progress.videos[i]=url;
   await checkpoint(job,progress,'scene_videos');
  }
  await checkpoint(job,progress,'montage');
  await render(job,brief,progress,progress.videos,plan);
 }catch(e){
  if(e instanceof Review){
   await db.needsReview(job,e.message,progress);
   console.log('HYPERREAL_NEEDS_REVIEW job='+job.id+' code='+e.message);
  }else if(e instanceof Failure ||
    /^hyperreal_(research|scene|identity|output|result|stored)/.test(String(e.message||''))){
   await db.fail(job,e.message,progress);
   console.log('HYPERREAL_FAILED_REFUNDED job='+job.id+' code='+e.message);
  }else{
   // An infrastructure crash does not prove a provider error. Persist the
   // request IDs and resume on the next cron invocation without paying twice.
   await db.unlock(job,progress).catch(()=>{});
   console.log('HYPERREAL_RETRYABLE_INFRA job='+job.id);
   throw e;
  }
 }
}
const workerId=randomUUID();
const job=await db.claim(workerId);
if(!job){
 console.log('HYPERREAL_QUEUE_EMPTY; no provider calls or wallet writes');
 process.exit(0);
}
console.log('HYPERREAL_PROCESSING job='+job.id+' status='+job.status);
await execute(job);
