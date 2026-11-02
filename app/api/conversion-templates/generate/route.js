import {
  getWalletEnvironment, requireWalletUser, getPricedModel,
  createReservedJob, updateJobStatus, jsonError
} from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';
import {
  findConversionTemplate, buildStrictTemplatePrompt, isSafePublicImageUrl
} from '@/lib/conversion-templates/catalog';

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
    if (Number(request.headers.get('content-length') || 0) > 8192) {
      return Response.json({ error: 'request_too_large' }, { status: 413 });
    }
    const body = await request.json();
    const template = findConversionTemplate(body?.template_id);
    if (!template) return Response.json({ error: 'template_not_found' }, { status: 404 });
    if (!body.claims_confirmed) return Response.json({ error: 'product_claims_not_confirmed' }, { status: 400 });
    if (!isSafePublicImageUrl(body.product_url)) {
      return Response.json({ error: 'invalid_product_url' }, { status: 400 });
    }
    if (typeof body.idempotency_key !== 'string' ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(body.idempotency_key)) {
      return Response.json({ error: 'invalid_idempotency_key' }, { status: 400 });
    }
    const referenceUrl = env[template.referenceEnvKey];
    const modelId = env[template.modelEnvKey];
    if (!isSafePublicImageUrl(referenceUrl) || !modelId) {
      return Response.json({ error: 'template_not_configured' }, { status: 503 });
    }
    const model = await getPricedModel(env.WALLETS_DB, modelId);
    if (!model || !/^[A-Za-z0-9_-]+$/.test(model.muapi_endpoint)) {
      return Response.json({ error: 'priced_image_model_unavailable' }, { status: 503 });
    }
    const allowed = JSON.parse(model.allowed_input_keys_json);
    const fixed = JSON.parse(model.fixed_options_json);
    if (!Array.isArray(allowed) || !fixed || typeof fixed !== 'object' || Array.isArray(fixed)) {
      return Response.json({ error: 'invalid_image_model_configuration' }, { status: 503 });
    }
    // Este modelo debe admitir dos referencias. Nunca aceptar modelo, costo ni prompt desde el cliente.
    const input = {
      prompt: buildStrictTemplatePrompt(template),
      images_list: [referenceUrl, body.product_url]
    };
    if (allowed.includes('aspect_ratio') && !Object.hasOwn(fixed, 'aspect_ratio')) {
      input.aspect_ratio = template.aspectRatio;
    }
    if (Object.keys(input).some((key) => !allowed.includes(key) || Object.hasOwn(fixed, key))) {
      return Response.json({ error: 'model_does_not_support_template_references' }, { status: 503 });
    }
    const price = model.customer_price_cents;
    const job = await createReservedJob(env.WALLETS_DB, {
      userId: user.id,
      modelId,
      priceCents: price,
      idempotencyKey: body.idempotency_key
    });
    if (!job.newlyCreated) {
      return Response.json({ job_id: job.id, status: job.status, idempotent: true });
    }
    // Mantener la misma semántica de reserva y conciliación del motor de billeteras.
    try {
      const upstream = await fetch('https://api.muapi.ai/api/v1/' + model.muapi_endpoint, {
        method: 'POST',
        headers: { 'x-api-key': env.MUAPI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...input, ...fixed })
      });
      if (upstream.status >= 400 && upstream.status < 500) {
        await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, 'upstream_rejected');
        return Response.json({ job_id: job.id, status: 'failed', error: 'upstream_rejected' }, { status: 422 });
      }
      if (!upstream.ok) throw new Error('upstream_ambiguous_response');
      const result = await upstream.json();
      const providerId = result.request_id || result.id;
      if (typeof providerId !== 'string' || !providerId) throw new Error('upstream_missing_request_id');
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'submitted', providerId);
      return Response.json({
        job_id: job.id,
        status: 'submitted',
        customer_price_cents: price,
        template_id: template.id
      }, { status: 202 });
    } catch {
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'unknown', null, 'manual_reconciliation_required');
      return Response.json({
        job_id: job.id,
        status: 'unknown',
        message: 'Reserva retenida para conciliación; no vuelvas a pagar por esta solicitud.'
      }, { status: 202 });
    }
  } catch (error) { return jsonError(error); }
}
