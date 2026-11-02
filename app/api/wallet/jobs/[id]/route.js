import {
  getWalletEnvironment, requireWalletUser,
  getGenerationJob, updateJobStatus, jsonError
} from '@/lib/wallet/server';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    const { id } = await params;
    const job = await getGenerationJob(env.WALLETS_DB, user.id, id);
    if (!job) return Response.json({ error: 'job_not_found' }, { status: 404 });
    if (job.status === 'completed' || job.status === 'failed' || !job.provider_request_id) {
      return Response.json({ job_id: job.id, status: job.status, customer_price_cents: job.price_cents,
        result: job.status === 'completed' && job.result_json ? JSON.parse(job.result_json) : undefined },
        { headers: { 'Cache-Control': 'no-store' } });
    }
    if (!isMuapiGenerationEnabled(env,user)) {
      return Response.json({ error: 'generation_disabled_in_test_environment' }, { status: 503 });
    }
    if (!env.MUAPI_API_KEY) return Response.json({ error: 'muapi_secret_not_configured' }, { status: 503 });
    const providerResponse = await fetch(
      'https://api.muapi.ai/api/v1/predictions/' + encodeURIComponent(job.provider_request_id) + '/result', {
      headers: { 'x-api-key': env.MUAPI_API_KEY },
    });
    if (!providerResponse.ok) {
      return Response.json({ job_id: job.id, status: job.status, polling_error: true }, { status: 202 });
    }
    const result = await providerResponse.json();
    const status = String(result.status || '').toLowerCase();
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
    return Response.json({ job_id: job.id, status: job.status, provider_status: status },
      { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return jsonError(error);
  }
}
