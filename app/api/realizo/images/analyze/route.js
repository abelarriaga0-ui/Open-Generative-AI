import {getWalletEnvironment,requireWalletUser,getPricedModel,createReservedJob,updateJobStatus,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {isConversionImageGenerationEnabled} from '@/lib/wallet/generation-policy';
import {normalizeImageBrief,SAFE_ID,buildResearchSystemPrompt,buildResearchUserPrompt} from '@/lib/realizo-images/creative';
export const dynamic='force-dynamic';
const error=(code,status=422)=>Response.json({error:code},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 if(!enforceSameOrigin(request))return error('invalid_origin',403);
 try{
  if(Number(request.headers.get('content-length')||0)>9000)return error('request_too_large',413);
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  if(!isConversionImageGenerationEnabled(env))return error('images_not_ready',503);
  const body=await request.json();
  let brief;
  try{brief=normalizeImageBrief(body?.brief);}catch(e){return error(e.message);}
  if(!SAFE_ID.test(body?.upload_id||'')||!SAFE_ID.test(body?.idempotency_key||''))return error('invalid_reference');
  const upload=await env.WALLETS_DB.prepare('SELECT image_url FROM realizo_image_uploads WHERE id=? AND user_id=?')
   .bind(body.upload_id,user.id).first();
  if(!upload)return error('product_image_not_found',404);
  const id=env.REALIZO_TEMPLATE_ANALYZER_MODEL_ID;
  const model=await getPricedModel(env.WALLETS_DB,id);
  if(!model||model.muapi_endpoint!=='gemini-2-5-flash')return error('research_model_unavailable',503);
  const allowed=JSON.parse(model.allowed_input_keys_json);
  const fixed=JSON.parse(model.fixed_options_json);
  if(!['prompt','system_prompt','image_url'].every(k=>allowed.includes(k))||
     !fixed||typeof fixed!=='object'||Array.isArray(fixed)||
     ['prompt','system_prompt','image_url'].some(k=>Object.hasOwn(fixed,k)))return error('research_model_incompatible',503);
  const job=await createReservedJob(env.WALLETS_DB,{
   userId:user.id,modelId:model.model_id,priceCents:model.customer_price_cents,
   idempotencyKey:'image_research_v1_'+body.idempotency_key
  });
  if(!job.newlyCreated)return Response.json({job_id:job.id,status:job.status,idempotent:true});
  const input={
   ...fixed,
   system_prompt:buildResearchSystemPrompt(),
   prompt:buildResearchUserPrompt(brief),
   image_url:upload.image_url
  };
  try{
   const upstream=await fetch('https://api.muapi.ai/api/v1/gemini-2-5-flash',{
    method:'POST',headers:{'x-api-key':env.MUAPI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(input),signal:AbortSignal.timeout(45000)
   });
   if(upstream.status>=400&&upstream.status<500){
    await updateJobStatus(env.WALLETS_DB,user.id,job.id,'failed',null,'provider_rejected');
    return error('research_provider_rejected',422);
   }
   if(!upstream.ok)throw Error('provider_ambiguous');
   const data=await upstream.json();
   const providerId=data.request_id||data.id;
   if(typeof providerId!=='string'||!providerId)throw Error('provider_missing_id');
   await updateJobStatus(env.WALLETS_DB,user.id,job.id,'submitted',providerId);
   return Response.json({job_id:job.id,status:'submitted',price_cents:model.customer_price_cents},{status:202});
  }catch{
   await updateJobStatus(env.WALLETS_DB,user.id,job.id,'unknown',null,'manual_reconciliation');
   return Response.json({job_id:job.id,status:'unknown',message:'Consulta pendiente de conciliación.'},{status:202});
  }
 }catch(e){return jsonError(e);}
}
