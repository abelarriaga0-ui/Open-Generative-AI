import {getCloudflareContext} from '@opennextjs/cloudflare';
import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {
  documentType,prepareHyperrealDocumentContent,buildHyperrealDocumentRequest,
  parseHyperrealDocumentResponse
} from '@/lib/realizo-creative/hyperreal-document';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const response=(data,status=200)=>Response.json(data,{status,headers});
const fail=(error,status=422)=>response({error},status);
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const RESULT_LIMIT=10000;

async function setJob(db,userId,id,status,providerId=null,result=null,reason=null){
  await db.prepare("UPDATE realizo_hyperreal_document_jobs SET status=?,"+
    "provider_response_id=COALESCE(?,provider_response_id),"+
    "result_json=COALESCE(?,result_json),failure_code=?,updated_at=datetime('now') "+
    "WHERE id=? AND user_id=? AND status IN ('starting','submitted')")
    .bind(status,providerId,result,reason,id,userId).run();
}
function safeJob(row){
  return {
    job_id:row.id,status:row.status,
    result:row.status==='completed'&&row.result_json?JSON.parse(row.result_json):null,
    error:row.status==='failed'?row.failure_code:null
  };
}
async function startDocumentAnalysis(env,userId,id,document){
  try{
    const outgoing=buildHyperrealDocumentRequest(env,document);
    const resp=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',headers:{Authorization:'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify(outgoing),signal:AbortSignal.timeout(22000)
    });
    if(!resp.ok){
      await setJob(env.WALLETS_DB,userId,id,'failed',null,null,
        resp.status===429?'document_ai_busy':'document_ai_unavailable');
      return;
    }
    const data=await resp.json();
    if(typeof data.id!=='string'||!/^resp_[a-zA-Z0-9_-]+$/.test(data.id))
      throw Error('invalid_provider_response');
    await setJob(env.WALLETS_DB,userId,id,'submitted',data.id);
  }catch{
    // No blind second OpenAI request. An ambiguous upstream response may have cost money.
    await setJob(env.WALLETS_DB,userId,id,'failed',null,null,'document_ai_unavailable').catch(()=>{});
  }
}
async function reconcileJob(env,userId,row){
  if(row.status==='completed'||row.status==='failed')return row;
  if(!row.provider_response_id){
    const age=Date.now()-Date.parse(row.created_at.replace(' ','T')+'Z');
    if(Number.isFinite(age)&&age>5*60*1000){
      await setJob(env.WALLETS_DB,userId,row.id,'failed',null,null,'document_submission_expired');
      return {...row,status:'failed',failure_code:'document_submission_expired'};
    }
    return row;
  }
  if(!env.OPENAI_API_KEY)return row;
  let info;
  try{
    const upstream=await fetch('https://api.openai.com/v1/responses/'+encodeURIComponent(row.provider_response_id),{
      headers:{Authorization:'Bearer '+env.OPENAI_API_KEY},
      signal:AbortSignal.timeout(12000)
    });
    if(!upstream.ok)return row;
    info=await upstream.json();
  }catch{return row;}
  if(info.status==='completed'){
    try{
      const result=JSON.stringify(parseHyperrealDocumentResponse(info));
      if(result.length>RESULT_LIMIT)throw Error('result_too_large');
      await setJob(env.WALLETS_DB,userId,row.id,'completed',null,result);
      return {...row,status:'completed',result_json:result};
    }catch{
      await setJob(env.WALLETS_DB,userId,row.id,'failed',null,null,'document_result_invalid');
      return {...row,status:'failed',failure_code:'document_result_invalid'};
    }
  }
  if(['failed','cancelled','expired','incomplete'].includes(info.status)){
    await setJob(env.WALLETS_DB,userId,row.id,'failed',null,null,'document_ai_unavailable');
    return {...row,status:'failed',failure_code:'document_ai_unavailable'};
  }
  return row;
}
export async function POST(request){
  if(!enforceSameOrigin(request))return fail('invalid_origin',403);
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return fail('not_authenticated',401);
    if(!env.OPENAI_API_KEY||!env.OPENAI_PREMIUM_MODEL)return fail('document_ai_not_configured',503);
    if(Number(request.headers.get('content-length')||0)>5*1024*1024)
      return fail('document_too_large',413);
    if(typeof getCloudflareContext().ctx?.waitUntil!=='function')
      return fail('background_unavailable',503);
    const form=await request.formData();
    const file=form.get('document'),key=form.get('request_key');
    if(!file||typeof file.arrayBuffer!=='function')return fail('document_required',400);
    if(typeof key!=='string'||!UUID.test(key))return fail('invalid_request_key',400);
    try{documentType(file);}catch{return fail('unsupported_document',422);}
    const existing=await env.WALLETS_DB.prepare(
      'SELECT * FROM realizo_hyperreal_document_jobs WHERE user_id=? AND request_key=?'
    ).bind(user.id,key).first();
    if(existing)return response(safeJob(existing),202);
    let document;
    try{document=await prepareHyperrealDocumentContent(file);}
    catch(e){return fail(e?.message||'document_unreadable',422);}
    const id=crypto.randomUUID();
    try{
      const write=await env.WALLETS_DB.prepare(
        'INSERT OR IGNORE INTO realizo_hyperreal_document_jobs(id,user_id,request_key) VALUES(?,?,?)'
      ).bind(id,user.id,key).run();
      if(Number(write.meta?.changes)===0){
        const prior=await env.WALLETS_DB.prepare(
          'SELECT * FROM realizo_hyperreal_document_jobs WHERE user_id=? AND request_key=?'
        ).bind(user.id,key).first();
        if(prior)return response(safeJob(prior),202);
      }
    }catch(e){
      if(String(e).includes('hyperreal_document_daily_limit'))
        return fail('document_daily_limit',429);
      throw e;
    }
    getCloudflareContext().ctx.waitUntil(startDocumentAnalysis(env,user.id,id,document));
    return response({job_id:id,status:'starting',limit_per_day:3,charge_cents:0},202);
  }catch(e){return jsonError(e);}
}
export async function GET(request){
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return fail('not_authenticated',401);
    const id=new URL(request.url).searchParams.get('job_id');
    if(id&&!UUID.test(id))return fail('invalid_request_key',400);
    const row=id?await env.WALLETS_DB.prepare(
      'SELECT * FROM realizo_hyperreal_document_jobs WHERE user_id=? AND id=?'
    ).bind(user.id,id).first():await env.WALLETS_DB.prepare(
      'SELECT * FROM realizo_hyperreal_document_jobs WHERE user_id=? ORDER BY created_at DESC LIMIT 1'
    ).bind(user.id).first();
    if(!row)return response({job_id:null,status:'none'});
    const fresh=await reconcileJob(env,user.id,row);
    return response(safeJob(fresh),fresh.status==='completed'||fresh.status==='failed'?200:202);
  }catch(e){return jsonError(e);}
}
