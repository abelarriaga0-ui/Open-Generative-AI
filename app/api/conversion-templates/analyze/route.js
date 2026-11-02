import {
  getWalletEnvironment, requireWalletUser, getPricedModel,
  createReservedJob, updateJobStatus, jsonError
} from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';
import { findConversionTemplate } from '@/lib/conversion-templates/catalog';
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt } from '@/lib/conversion-templates/analysis';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!enforceSameOrigin(request)) return Response.json({ error: 'invalid_origin' }, { status: 403 });
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    if (!isMuapiGenerationEnabled(env)) {
      return Response.json({ error: 'generation_disabled_in_test_environment' }, { status: 503 });
    }
    if (!env.MUAPI_API_KEY) return Response.json({ error: 'muapi_secret_not_configured' }, { status: 503 });
    if (Number(request.headers.get('content-length') || 0) > 6000) {
      return Response.json({ error: 'request_too_large' }, { status: 413 });
    }
    const body = await request.json();
    const template = findConversionTemplate(body?.template_id);
    if (!template) return Response.json({ error: 'template_not_found' }, { status: 404 });
    if (typeof body.description !== 'string' || !body.description.trim() || body.description.length > 1200) {
      return Response.json({ error: 'invalid_optional_changes' }, { status: 400 });
    }
    if (typeof body.idempotency_key !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(body.idempotency_key)) {
      return Response.json({ error: 'invalid_idempotency_key' }, { status: 400 });
    }
    const modelId = env.REALIZO_TEMPLATE_ANALYZER_MODEL_ID;
    if (!modelId) return Response.json({ error: 'analysis_model_not_configured' }, { status: 503 });
    const model = await getPricedModel(env.WALLETS_DB, modelId);
    if (!model || model.muapi_endpoint !== 'gemini-2-5-flash') {
      return Response.json({ error: 'gemini_analysis_model_unavailable' }, { status: 503 });
    }
    const allowed = JSON.parse(model.allowed_input_keys_json);
    const fixed = JSON.parse(model.fixed_options_json);
    if (!Array.isArray(allowed) || !allowed.includes('prompt') || !allowed.includes('system_prompt') ||
      !fixed || typeof fixed !== 'object' || Array.isArray(fixed) ||
      Object.hasOwn(fixed, 'prompt') || Object.hasOwn(fixed, 'system_prompt')) {
      return Response.json({ error: 'invalid_gemini_model_configuration' }, { status: 503 });
    }
    const input = {
      system_prompt: buildAnalysisSystemPrompt(),
      prompt: buildAnalysisUserPrompt(template, body.description.trim()),
      ...fixed
    };
    const idempotencyKey = 'analysis_' + template.id + '_' + body.idempotency_key;
    const job = await createReservedJob(env.WALLETS_DB, {
      userId: user.id, modelId, priceCents: model.customer_price_cents, idempotencyKey
    });
    if (!job.newlyCreated) {
      return Response.json({ job_id: job.id, status: job.status, idempotent: true });
    }
    try {
      const upstream = await fetch('https://api.muapi.ai/api/v1/gemini-2-5-flash', {
        method: 'POST',
        headers: { 'x-api-key': env.MUAPI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      if (upstream.status >= 400 && upstream.status < 500) {
        await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, 'upstream_rejected');
        return Response.json({ job_id: job.id, status: 'failed', error: 'analysis_rejected' }, { status: 422 });
      }
      if (!upstream.ok) throw new Error('ambiguous_gemini_response');
      const payload = await upstream.json();
      const requestId = payload.request_id || payload.id;
      if (typeof requestId !== 'string' || !requestId) throw new Error('upstream_missing_request_id');
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'submitted', requestId);
      return Response.json({ job_id: job.id, status: 'submitted', customer_price_cents: model.customer_price_cents }, { status: 202 });
    } catch {
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'unknown', null, 'manual_reconciliation_required');
      return Response.json({
        job_id: job.id, status: 'unknown',
        message: 'Análisis en conciliación. No vuelvas a solicitarlo para evitar un cargo duplicado.'
      }, { status: 202 });
    }
  } catch (error) { return jsonError(error); }
}
