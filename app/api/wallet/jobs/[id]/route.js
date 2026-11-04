import {
  getWalletEnvironment, requireWalletUser,
  getGenerationJob, updateJobStatus, jsonError
} from '@/lib/wallet/server';
import { isMuapiGenerationEnabled, isConversionImageGenerationEnabled } from '@/lib/wallet/generation-policy';

import { shouldExpireImageJob, imageExpiryReason } from '@/lib/realizo-images/job-timeout';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const { id } = await params;
    const job = await getGenerationJob(env.WALLETS_DB, user.id, id);
    if (!job) return Response.json({ error: 'job_not_found' }, { status: 404 });
    if (shouldExpireImageJob(job) && !job.provider_request_id) {
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, imageExpiryReason(job));
      const settled = await getGenerationJob(env.WALLETS_DB, user.id, id);
      return Response.json({ job_id: settled.id, status: settled.status,
        customer_price_cents: settled.price_cents,
        timeout_refunded: settled.status === 'failed',
        result: settled.status === 'completed' && settled.result_json ? JSON.parse(settled.result_json) : undefined },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    if (job.status === 'completed' || job.status === 'failed' || !job.provider_request_id) {
      return Response.json({ job_id: job.id, status: job.status, customer_price_cents: job.price_cents,
        result: job.status === 'completed' && job.result_json ? JSON.parse(job.result_json) : undefined },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    const isTemplateImageJob = [env.REALIZO_TEMPLATE_IMAGE_MODEL_ID, env.REALIZO_TEMPLATE_ANALYZER_MODEL_ID]
      .filter(Boolean).includes(job.model_id);
    const enabled = isTemplateImageJob
      ? isConversionImageGenerationEnabled(env)
      : isMuapiGenerationEnabled(env,user);
    if (!enabled) {
      return Response.json({ error: 'generation_disabled_in_test_environment' }, { status: 503 });
    }
    if (!env.MUAPI_API_KEY) return Response.json({ error: 'muapi_secret_not_configured' }, { status: 503 });
    let providerResponse;
    try {
      providerResponse = await fetch(
        'https://api.muapi.ai/api/v1/predictions/' + encodeURIComponent(job.provider_request_id) + '/result', {
        headers: { 'x-api-key': env.MUAPI_API_KEY },
        signal: AbortSignal.timeout(12000)
      });
    } catch {
      if (shouldExpireImageJob(job)) {
        await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, imageExpiryReason(job));
        return Response.json({job_id:job.id,status:'failed',timeout_refunded:true},
          {headers:{'Cache-Control':'no-store'}});
      }
      return Response.json({job_id:job.id,status:job.status,polling_error:true},{status:202});
    }
    const result = await providerResponse.json().catch(() => ({}));
    const status = String(result.status || result.detail?.status || '').toLowerCase();
    if (!providerResponse.ok && ['failed','cancelled','canceled'].includes(status)) {
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, 'provider_failed');
      return Response.json({ job_id: job.id, status: 'failed', customer_price_cents: job.price_cents,
        provider_failed: true }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!providerResponse.ok) {
      if (shouldExpireImageJob(job)) {
        await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, imageExpiryReason(job));
        return Response.json({ job_id: job.id, status: 'failed', timeout_refunded: true,
          customer_price_cents: job.price_cents }, { headers: { 'Cache-Control': 'no-store' } });
      }
      return Response.json({ job_id: job.id, status: job.status, polling_error: true }, { status: 202 });
    }
    if (['completed','succeeded','success'].includes(status)) {
      const safeResult = {
        status,
        outputs: result.outputs,
        output: result.output,
        url: result.url,
        request_id: job.provider_request_id,
      };
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'completed', null, null,
        JSON.stringify(safeResult).length <= 65000
          ? JSON.stringify(safeResult)
          : JSON.stringify({ status, request_id: job.provider_request_id, url: result.url || null }));
      return Response.json({ job_id: job.id, status: 'completed', result: safeResult,
        customer_price_cents: job.price_cents }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (['failed','cancelled','canceled'].includes(status)) {
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, 'provider_failed');
      return Response.json({ job_id: job.id, status: 'failed', customer_price_cents: job.price_cents });
    }
    if (shouldExpireImageJob(job)) {
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, imageExpiryReason(job));
      const expired = await getGenerationJob(env.WALLETS_DB, user.id, id);
      return Response.json({ job_id: expired.id, status: expired.status,
        timeout_refunded: expired.status === 'failed',
        customer_price_cents: expired.price_cents }, { headers: { 'Cache-Control':'no-store' } });
    }
    const progressRaw=result.progress ?? result.data?.progress ?? result.metrics?.progress;
    const progressNumeric=typeof progressRaw==='number'?progressRaw:Number(progressRaw);
    const progressPercent=progressRaw!=null && Number.isFinite(progressNumeric) && progressNumeric>=0 && progressNumeric<=100
      ?Math.round(progressNumeric<=1?progressNumeric*100:progressNumeric):null;
    return Response.json({ job_id: job.id, status: job.status, provider_status: status,
      provider_progress_percent:progressPercent },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
