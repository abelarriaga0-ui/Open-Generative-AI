import {getWalletEnvironment,requireWalletUser,getPricedModel,createReservedJob,updateJobStatus,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {isConversionImageGenerationEnabled} from '@/lib/wallet/generation-policy';
import {normalizeImageBrief,SAFE_ID,buildSalesImagePrompt,fallbackImageResearch} from '@/lib/realizo-images/creative';

export const dynamic='force-dynamic';
const failure=(error,status=422)=>Response.json({error},{status,headers:{'Cache-Control':'private,no-store'}});

// El modelo de imagen integra investigación visual y generación en una sola solicitud.
// No requiere ni cobra un análisis Gemini previo.
export async function POST(request){
 if(!enforceSameOrigin(request))return failure('invalid_origin',403);
 try{
  if(Number(request.headers.get('content-length')||0)>9000)return failure('request_too_large',413);
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return failure('not_authenticated',401);
  if(!isConversionImageGenerationEnabled(env))return failure('images_not_ready',503);
  const body=await request.json();
  let brief;
  try{brief=normalizeImageBrief(body?.brief);}catch(e){return failure(e.message);}
  if(!SAFE_ID.test(body?.upload_id||'')||!SAFE_ID.test(body?.idempotency_key||''))return failure('invalid_reference');
  const upload=await env.WALLETS_DB.prepare(
   'SELECT image_url FROM realizo_image_uploads WHERE id=? AND user_id=?'
  ).bind(body.upload_id,user.id).first();
  if(!upload)return failure('product_image_not_found',404);

  const model=await getPricedModel(env.WALLETS_DB,env.REALIZO_TEMPLATE_IMAGE_MODEL_ID);
  if(!model||model.muapi_endpoint!=='nano-banana-2-1-edit')return failure('image_model_unavailable',503);
  let fixed,allowed;
  try{fixed=JSON.parse(model.fixed_options_json);allowed=JSON.parse(model.allowed_input_keys_json);}catch{return failure('image_model_incompatible',503);}
  if(!Array.isArray(allowed)||!allowed.includes('prompt')||!allowed.includes('images_list')||
     !fixed||fixed.resolution!=='4k'||fixed.output_format!=='png')return failure('image_model_incompatible',503);

  const concept=fallbackImageResearch(brief);
  const prompt=buildSalesImagePrompt(brief,concept);
  const input={
   ...fixed,
   prompt,
   images_list:[upload.image_url],
   aspect_ratio:brief.aspect_ratio,
   resolution:'4k',
   output_format:'png',
   google_search:true
  };

  const job=await createReservedJob(env.WALLETS_DB,{
   userId:user.id,modelId:model.model_id,priceCents:model.customer_price_cents,
   idempotencyKey:'image_create_v1_'+body.idempotency_key
  });
  if(!job.newlyCreated)return Response.json({job_id:job.id,status:job.status,idempotent:true},{headers:{'Cache-Control':'private,no-store'}});

  try{
   // Compatibilidad con el esquema D1 anterior: el campo research_job_id NOT NULL
   // apunta al mismo trabajo de imagen. No se crea ni factura ningún trabajo Gemini.
   await env.WALLETS_DB.prepare(
    'INSERT INTO realizo_image_creations (id,user_id,image_job_id,research_job_id,upload_id,brief_json) VALUES (?,?,?,?,?,?)'
   ).bind(crypto.randomUUID(),user.id,job.id,job.id,body.upload_id,JSON.stringify(brief)).run();
  }catch{
   await updateJobStatus(env.WALLETS_DB,user.id,job.id,'failed',null,'image_history_write_failed');
   return failure('image_setup_failed',503);
  }

  try{
   const response=await fetch('https://api.muapi.ai/api/v1/nano-banana-2-1-edit',{
    method:'POST',headers:{'x-api-key':env.MUAPI_API_KEY,'Content-Type':'application/json'},
    body:JSON.stringify(input),signal:AbortSignal.timeout(45000)
   });
   if(response.status>=400&&response.status<500){
    await updateJobStatus(env.WALLETS_DB,user.id,job.id,'failed',null,'provider_rejected');
    return failure('image_provider_rejected',422);
   }
   if(!response.ok)throw Error('provider_ambiguous');
   const data=await response.json();
   const providerId=data.request_id||data.id;
   if(typeof providerId!=='string'||!providerId)throw Error('provider_missing_id');
   await updateJobStatus(env.WALLETS_DB,user.id,job.id,'submitted',providerId);
   return Response.json({job_id:job.id,status:'submitted',price_cents:model.customer_price_cents},{status:202,headers:{'Cache-Control':'private,no-store'}});
  }catch{
   // Una respuesta indeterminada no debe provocar un segundo envío automático.
   await updateJobStatus(env.WALLETS_DB,user.id,job.id,'unknown',null,'manual_reconciliation');
   return Response.json({job_id:job.id,status:'unknown',message:'Seguimiento de la generación en curso.'},{status:202,headers:{'Cache-Control':'private,no-store'}});
  }
 }catch(e){return jsonError(e);}
}
