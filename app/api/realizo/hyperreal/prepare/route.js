// Hiperrealista PRO V2 only: one pre-authorized package for RESEARCH + 4K
// reference images + per-scene Kling 4.0 clips + background FFmpeg montage.
// No direct calls to existing ordinary video generate/quote APIs.
import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {ensureOwnedMedia} from '@/lib/wallet/live-video-models';
import {
  normalizeHyperrealProductionBrief,hyperrealShotPlan,hyperrealQuoteBreakdown,
  HYPERREAL_IMAGE_MODEL,HYPERREAL_VIDEO_MODEL,
  HYPERREAL_CHUNK_BYTES,HYPERREAL_IMAGE_RESOLUTION,HYPERREAL_VIDEO_RESOLUTION
} from '@/lib/realizo-creative/hyperreal-production';

export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'private,no-store'};
const ID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const error=(code,status=422)=>Response.json({error:code},{status,headers:HEADERS});
const safe=(v,max=200)=>String(v||'').slice(0,max);
function extractCost(body){
 const v=body?.cost??body?.estimated_cost??body?.estimate?.amount_usd??
  body?.estimate?.cost??body?.amount_usd??body?.cost?.amount_usd;
 const n=typeof v==='object'?Number(v?.amount_usd??v?.amount??v?.usd):Number(v);
 if(!Number.isFinite(n)||n<=0||n>=500)throw Error('hyperreal_quote_provider_unavailable');
 return n;
}
async function estimate(model,payload){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);
 try{
  const r=await fetch('https://api.muapi.ai/api/v1/models/'+model+'/estimate-cost',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify(payload),cache:'no-store',signal:controller.signal
  });
  if(!r.ok)throw Error('hyperreal_quote_provider_unavailable');
  return extractCost(await r.json());
 }finally{clearTimeout(timeout);}
}
async function calculateQuote(brief){
 const plan=hyperrealShotPlan(brief);
 const image=await estimate(HYPERREAL_IMAGE_MODEL,{
   prompt:'Natural photograph of the exact product and a realistic adult person in an ordinary environment.',
   images_list:[brief.image_url],aspect_ratio:brief.aspect_ratio,
   resolution:HYPERREAL_IMAGE_RESOLUTION,output_format:'jpg'
 });
 const byDuration=new Map();
 for(const seconds of [...new Set(plan.map(s=>s.seconds))]){
  byDuration.set(seconds,await estimate(HYPERREAL_VIDEO_MODEL,{
    prompt:'@image_1 is a reference photograph of a natural commercial scene.',
    image_urls:[brief.image_url],duration:seconds,
    resolution:HYPERREAL_VIDEO_RESOLUTION,aspect_ratio:brief.aspect_ratio
  }));
 }
 return hyperrealQuoteBreakdown(image,plan.map(s=>byDuration.get(s.seconds)),plan.length+1);
}
function publicJob(row){
 let progress={};
 try{progress=JSON.parse(row.progress_json||'{}');}catch{}
 const images=Array.isArray(progress.images)?progress.images.filter(Boolean).length:0;
 const videos=Array.isArray(progress.videos)?progress.videos.filter(Boolean).length:0;
 return {
  id:row.id,status:row.status,stage:row.stage,price_cents:row.price_cents,
  duration:JSON.parse(row.customer_brief_json||'{}').duration,
  image_count:images,video_count:videos,
  scene_count:JSON.parse(row.plan_json||'[]').length,
  failure_code:row.failure_code||null,
  has_video:row.status==='completed'&&row.result_bytes>10000,
  created_at:row.created_at,updated_at:row.updated_at
 };
}
async function uploadQuote(env,user,request,body){
 if(Number(request.headers.get('content-length')||0)>10000)return error('payload_too_large',413);
 if(!env.OPENAI_API_KEY||!env.MUAPI_API_KEY)return error('hyperreal_provider_not_ready',503);
 if(env.REALIZO_ENV!=='production'||env.PAYPAL_MODE!=='live'||
    env.MUAPI_GENERATION_ENABLED!=='true')
  return error('hyperreal_billing_not_ready',503);
 const key=body.request_key;
 if(typeof key!=='string'||!ID.test(key))return error('invalid_idempotency_key',400);
 let brief;
 try{brief=normalizeHyperrealProductionBrief(body.brief);}
 catch(e){return error(e.message,422);}
 try{await ensureOwnedMedia(env,user,{image_url:brief.image_url});}
 catch{return error('invalid_media_reference',422);}
 const fingerprintBytes=await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(JSON.stringify(brief)));
 const fingerprint=[...new Uint8Array(fingerprintBytes)].map(x=>x.toString(16).padStart(2,'0')).join('');
 const db=env.WALLETS_DB;
 const existing=await db.prepare(
  'SELECT * FROM realizo_hyperreal_pro_jobs WHERE user_id=? AND request_key=?'
 ).bind(user.id,key).first();
 if(existing){
  if(existing.fingerprint!==fingerprint)return error('idempotency_conflict',409);
  return Response.json({quote_id:existing.id,quote:JSON.parse(existing.quote_breakdown_json),
    status:existing.status,quote_expires_at:existing.quote_expires_at},{headers:HEADERS});
 }
 let quote;
 try{quote=await calculateQuote(brief);}
 catch{return error('hyperreal_quote_provider_unavailable',503);}
 const plan=hyperrealShotPlan(brief);
 const id=crypto.randomUUID(),expiry=Math.floor(Date.now()/1000)+8*60;
 try{
  await db.prepare(
   "INSERT OR IGNORE INTO realizo_hyperreal_pro_jobs "+
   "(id,user_id,request_key,fingerprint,product_asset_url,customer_brief_json,"+
   "plan_json,quote_breakdown_json,price_cents,quote_expires_at) "+
   "VALUES(?,?,?,?,?,?,?,?,?,?)"
  ).bind(id,user.id,key,fingerprint,brief.image_url,JSON.stringify(brief),
    JSON.stringify(plan),JSON.stringify(quote),quote.total_cents,expiry).run();
 }catch{return error('hyperreal_quote_storage_unavailable',503);}
 const row=await db.prepare(
  'SELECT * FROM realizo_hyperreal_pro_jobs WHERE user_id=? AND request_key=?'
 ).bind(user.id,key).first();
 if(!row)return error('hyperreal_quote_storage_unavailable',503);
 const wallet=await db.prepare('SELECT available_cents FROM wallets WHERE user_id=?')
  .bind(user.id).first();
 return Response.json({
  quote_id:row.id,quote:JSON.parse(row.quote_breakdown_json),
  status:row.status,quote_expires_at:row.quote_expires_at,
  affordable:Number(wallet?.available_cents||0)>=row.price_cents,
  available_cents:Number(wallet?.available_cents||0),
  explanation:'Incluye investigación comercial, imágenes 4K por escena, clips independientes y montaje. Un solo cargo tras confirmar.'
 },{headers:HEADERS});
}
async function confirmQuote(env,user,body){
 const id=body.quote_id;
 if(typeof id!=='string'||!ID.test(id))return error('invalid_quote_id',400);
 const db=env.WALLETS_DB;
 const row=await db.prepare(
  'SELECT id,status,quote_expires_at FROM realizo_hyperreal_pro_jobs WHERE id=? AND user_id=?'
 ).bind(id,user.id).first();
 if(!row)return error('quote_not_found',404);
 if(row.status!=='quoted'){
  return Response.json({job_id:id,status:row.status,idempotent:true},{headers:HEADERS});
 }
 if(Number(row.quote_expires_at)<=Math.floor(Date.now()/1000))
  return error('hyperreal_quote_expired',409);
 try{
  await db.prepare(
   "UPDATE realizo_hyperreal_pro_jobs SET status='reserved',stage='research',"+
   "updated_at=datetime('now') WHERE id=? AND user_id=? AND status='quoted' AND quote_expires_at>unixepoch()"
  ).bind(id,user.id).run();
 }catch(e){
  const reason=String(e);
  if(reason.includes('hyperreal_insufficient_funds'))return error('insufficient_wallet_credits',402);
  if(reason.includes('hyperreal_quote_expired'))return error('hyperreal_quote_expired',409);
  if(reason.includes('hyperreal_active_job_limit'))return error('hyperreal_active_job_limit',429);
  return error('hyperreal_reservation_failed',503);
 }
 const final=await db.prepare(
  'SELECT status FROM realizo_hyperreal_pro_jobs WHERE id=? AND user_id=?'
 ).bind(id,user.id).first();
 if(final?.status!=='reserved')return error('hyperreal_reservation_failed',503);
 return Response.json({job_id:id,status:'reserved',queue:'durable_background',
  message:'Tu video queda en producción; puedes salir de Realizo y volver después.'},{status:202,headers:HEADERS});
}
async function getVideo(request,env,user,id){
 const row=await env.WALLETS_DB.prepare(
  'SELECT id,status,result_bytes,result_sha256 FROM realizo_hyperreal_pro_jobs WHERE id=? AND user_id=?'
 ).bind(id,user.id).first();
 if(!row||row.status!=='completed'||Number(row.result_bytes)<10000)
  return error('video_not_ready',404);
 const total=Number(row.result_bytes);
 const rawRange=request.headers.get('range');
 const match=rawRange?.match(/^bytes=(\d+)-(\d*)$/);
 if(rawRange&&!match)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+total}});
 const start=match?Number(match[1]):0;
 if(!Number.isSafeInteger(start)||start>=total)
  return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+total}});
 const requestedEnd=match&&match[2]?Number(match[2]):total-1;
 const end=Math.min(total-1,requestedEnd,start+4*1024*1024-1);
 if(!Number.isSafeInteger(end)||end<start)return error('invalid_video_range',416);
 let at=start;
 const db=env.WALLETS_DB;
 const stream=new ReadableStream({
  async pull(controller){
   if(at>end){controller.close();return;}
   const index=Math.floor(at/HYPERREAL_CHUNK_BYTES);
   let record;
   try{
    record=await db.prepare(
     'SELECT data FROM realizo_hyperreal_pro_video_chunks WHERE job_id=? AND chunk_index=?'
    ).bind(id,index).first();
   }catch(e){controller.error(Error('video_chunk_unavailable'));return;}
   if(!record?.data){controller.error(Error('video_chunk_unavailable'));return;}
   const bytes=record.data instanceof Uint8Array?record.data:Uint8Array.from(record.data);
   const chunkStart=index*HYPERREAL_CHUNK_BYTES;
   const localStart=at-chunkStart,localEnd=Math.min(bytes.length,end-chunkStart+1);
   if(localEnd<=localStart){controller.error(Error('video_chunk_invalid'));return;}
   controller.enqueue(bytes.slice(localStart,localEnd));at+=localEnd-localStart;
  }
 });
 return new Response(stream,{status:match?206:200,headers:{
  'Content-Type':'video/mp4','Accept-Ranges':'bytes',
  'Content-Length':String(end-start+1),
  ...(match?{'Content-Range':'bytes '+start+'-'+end+'/'+total}:{}),
  'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff',
  'Content-Disposition':'inline; filename="realizo-hiperreal-'+id+'.mp4"'
 }});
}
export async function POST(request){
 if(!enforceSameOrigin(request))return error('invalid_origin',403);
 try{
  const env=await getWalletEnvironment(),user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  if(Number(request.headers.get('content-length')||0)>12000)return error('payload_too_large',413);
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object')return error('invalid_request',400);
  if(body.action==='quote')return uploadQuote(env,user,request,body);
  if(body.action==='confirm')return confirmQuote(env,user,body);
  return error('unsupported_hyperreal_action',400);
 }catch(e){return jsonError(e);}
}
export async function GET(request){
 try{
  const env=await getWalletEnvironment(),user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  const query=new URL(request.url).searchParams;
  const download=query.get('download');
  if(download){
   if(!ID.test(download))return error('invalid_job_id',400);
   return getVideo(request,env,user,download);
  }
  const id=query.get('job_id');
  if(id){
   if(!ID.test(id))return error('invalid_job_id',400);
   const item=await env.WALLETS_DB.prepare(
    'SELECT * FROM realizo_hyperreal_pro_jobs WHERE id=? AND user_id=?'
   ).bind(id,user.id).first();
   return item?Response.json({job:publicJob(item)},{headers:HEADERS}):error('job_not_found',404);
  }
  const list=await env.WALLETS_DB.prepare(
   'SELECT * FROM realizo_hyperreal_pro_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 12'
  ).bind(user.id).all();
  return Response.json({jobs:(list.results||[]).map(publicJob)},{headers:HEADERS});
 }catch(e){return jsonError(e);}
}
