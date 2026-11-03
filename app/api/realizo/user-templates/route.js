import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {normalizeSavedTemplate} from '@/lib/realizo-creative/user-templates';

export const dynamic='force-dynamic';
const privateHeaders={'Cache-Control':'private,no-store'};
const err=(error,status=422)=>Response.json({error},{status,headers:privateHeaders});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request){
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return err('not_authenticated',401);
    const rows=await env.WALLETS_DB.prepare(
      'SELECT id,title,category,description,model_id,duration_seconds,workflow_id,created_at FROM realizo_user_templates WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 100'
    ).bind(user.id).all();
    return Response.json({templates:rows.results||[]},{headers:privateHeaders});
  }catch(e){return jsonError(e);}
}

export async function POST(request){
  if(!enforceSameOrigin(request))return err('invalid_origin',403);
  try{
    if(Number(request.headers.get('content-length')||0)>16000)return err('request_too_large',413);
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return err('not_authenticated',401);
    const body=await request.json();
    if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>16000)
      return err('invalid_template');
    let raw=body;
    if(body.job_id!==undefined){
      if(typeof body.job_id!=='string'||!UUID.test(body.job_id))return err('invalid_job_id');
      const job=await env.WALLETS_DB.prepare(
        "SELECT status,template_source_json FROM generation_jobs WHERE id=? AND user_id=?"
      ).bind(body.job_id,user.id).first();
      if(!job)return err('job_not_found',404);
      if(job.status!=='completed')return err('template_requires_completed_video',409);
      if(!job.template_source_json)return err('template_source_unavailable',409);
      try{
        const source=JSON.parse(job.template_source_json);
        raw={...source,title:body.title};
      }catch{return err('template_source_unavailable',409);}
    }
    let prepared;
    try{prepared=normalizeSavedTemplate(raw);}
    catch{return err('invalid_template');}
    // A fixed per-account limit prevents unbounded D1 costs or accidental spam.
    const total=await env.WALLETS_DB.prepare(
      'SELECT COUNT(*) AS total FROM realizo_user_templates WHERE user_id=?'
    ).bind(user.id).first();
    if(Number(total?.total||0)>=100)return err('template_limit_reached',409);
    const id=crypto.randomUUID();
    await env.WALLETS_DB.prepare(
      'INSERT INTO realizo_user_templates (id,user_id,title,category,description,model_id,prompt,duration_seconds,workflow_id) VALUES (?,?,?,?,?,?,?,?,?)'
    ).bind(id,user.id,prepared.title,prepared.category,prepared.description,prepared.model_id,
      prepared.prompt,prepared.duration_seconds,prepared.workflow_id).run();
    return Response.json({template:{
      id,title:prepared.title,category:prepared.category,description:prepared.description,
      model_id:prepared.model_id,duration_seconds:prepared.duration_seconds,
      workflow_id:prepared.workflow_id
    }},{status:201,headers:privateHeaders});
  }catch(e){return jsonError(e);}
}
