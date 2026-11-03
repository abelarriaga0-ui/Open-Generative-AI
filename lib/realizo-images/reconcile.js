import { getGenerationJob, updateJobStatus } from '../wallet/server.js';
import { shouldExpireImageJob, imageExpiryReason } from './job-timeout.js';

function imageJobFilter(job, env) {
  const key=String(job.idempotency_key||'');
  return (key.startsWith('image_research_v1_') && job.model_id===env.REALIZO_TEMPLATE_ANALYZER_MODEL_ID) ||
    (key.startsWith('image_create_v1_') && job.model_id===env.REALIZO_TEMPLATE_IMAGE_MODEL_ID);
}

export async function reconcileImageJob(env, userId, job) {
  if (!imageJobFilter(job,env) || !['reserved','submitted','unknown'].includes(job.status)) return;
  if (job.provider_request_id && env.MUAPI_API_KEY) {
    try {
      const response=await fetch(
        'https://api.muapi.ai/api/v1/predictions/'+encodeURIComponent(job.provider_request_id)+'/result',
        {headers:{'x-api-key':env.MUAPI_API_KEY},signal:AbortSignal.timeout(9000)}
      );
      const result=await response.json().catch(()=>({}));
      const status=String(result.status||result.detail?.status||'').toLowerCase();
      if (['completed','success','succeeded'].includes(status) && response.ok) {
        const output={status,outputs:result.outputs,output:result.output,url:result.url,request_id:job.provider_request_id};
        const stored=JSON.stringify(output);
        await updateJobStatus(env.WALLETS_DB,userId,job.id,'completed',null,null,
          stored.length<=65000?stored:JSON.stringify({status,url:result.url||null}));
        return;
      }
      if (['failed','cancelled','canceled'].includes(status)) {
        await updateJobStatus(env.WALLETS_DB,userId,job.id,'failed',null,'provider_failed');
        return;
      }
    } catch {
      // Un error temporal de red no significa que el modelo haya fallado.
    }
  }
  if (shouldExpireImageJob(job)) {
    await updateJobStatus(env.WALLETS_DB,userId,job.id,'failed',null,imageExpiryReason(job));
  }
}

export async function reconcilePendingUserImages(env,userId) {
  if (!env?.MUAPI_API_KEY || !env?.WALLETS_DB) return;
  const jobs=await env.WALLETS_DB.prepare(
    "SELECT id,model_id,idempotency_key,status,provider_request_id,created_at FROM generation_jobs "+
    "WHERE user_id=? AND status IN ('reserved','submitted','unknown') "+
    "AND (idempotency_key LIKE 'image_research_v1_%' OR idempotency_key LIKE 'image_create_v1_%') "+
    "ORDER BY created_at ASC LIMIT 8"
  ).bind(userId).all();
  await Promise.allSettled((jobs.results||[]).map(job=>reconcileImageJob(env,userId,job)));
}
