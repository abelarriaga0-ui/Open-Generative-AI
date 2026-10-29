import {
  getWalletEnvironment, requireWalletUser, getPricedModel,
  createReservedJob, updateJobStatus, jsonError
} from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';
import {isPilotAccount,claimPilotSlot,isPilotPriceConfigValid,isOwnedSignedProductImage,PILOT_MODEL_ID} from '@/lib/wallet/muapi-pilot';

export const dynamic = 'force-dynamic';

function validInput(input) {
  return input && typeof input === 'object' && !Array.isArray(input) &&
    !Object.keys(input).some(key => /^(webhook|webhook_url|callback_url|api_key|x-api-key)$/i.test(key));
}

export async function POST(request) {
  if (!enforceSameOrigin(request)) {
    return Response.json({ error: 'invalid_origin' }, { status: 403 });
  }
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    if (!isMuapiGenerationEnabled(env,user)) {
      return Response.json({ error: 'generation_disabled_in_test_environment' }, { status: 503 });
    }
    if (!env.MUAPI_API_KEY) {
      return Response.json({ error: 'muapi_secret_not_configured' }, { status: 503 });
    }
    if (Number(request.headers.get('content-length') || 0) > 131072) {
      return Response.json({ error: 'payload_too_large' }, { status: 413 });
    }
    const body = await request.json();
    if (!validInput(body?.input) || JSON.stringify(body.input).length > 131072 ||
        typeof body?.model_id !== 'string' || body.model_id.length > 100 ||
        typeof body?.idempotency_key !== 'string' ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(body.idempotency_key)) {
      return Response.json({ error: 'invalid_generation_request' }, { status: 400 });
    }
    const model = await getPricedModel(env.WALLETS_DB, body.model_id);
    if (!model) return Response.json({ error: 'model_not_available' }, { status: 404 });
    const pilot=env.REALIZO_ENV==='sandbox';
    if (pilot && (!isPilotAccount(env,user)||!isPilotPriceConfigValid(model) ||
      body.model_id!==PILOT_MODEL_ID)) {
      return Response.json({error:'pilot_model_not_allowed'},{status:403});
    }
    if (!/^[A-Za-z0-9_-]+$/.test(model.muapi_endpoint)) {
      throw new Error('invalid_configured_endpoint');
    }
    // The buyer cannot override expensive duration, size, quality or resolution fields.
    // Operators must define separate priced model variants for those options.
    const allowed = JSON.parse(model.allowed_input_keys_json);
    const fixed = JSON.parse(model.fixed_options_json);
    if (!Array.isArray(allowed) || !allowed.every(key => typeof key === 'string') ||
        !fixed || typeof fixed !== 'object' || Array.isArray(fixed)) {
      throw new Error('invalid_catalog_configuration');
    }
    // The original video editor includes selected duration, quality and
    // resolution. Permit repeating an operator-locked value, never changing it.
    if (Object.keys(body.input).some(key =>
      (key in fixed && body.input[key] !== fixed[key]) ||
      (!(key in fixed) && !allowed.includes(key))
    )) {
      return Response.json({ error: 'model_input_not_allowed' }, { status: 400 });
    }
    if(pilot){
      const url=body.input.image_url;
      if(!await isOwnedSignedProductImage(env,user,url) ||
         typeof body.input.prompt!=='string'||body.input.prompt.trim().length<5||
         body.input.prompt.length>6000 ||
         !['16:9','9:16'].includes(body.input.aspect_ratio||'16:9')) {
        return Response.json({error:'pilot_image_or_prompt_invalid'},{status:400});
      }
    }
    const pricedInput = { ...body.input, ...fixed };

    const job = await createReservedJob(env.WALLETS_DB, {
      userId: user.id,
      modelId: model.model_id,
      priceCents: model.customer_price_cents,
      idempotencyKey: body.idempotency_key,
    });
    if (!job.newlyCreated) {
      return Response.json({ job_id: job.id, status: job.status, idempotent: true });
    }
    if(pilot){
      // A single D1 primary-key slot prevents concurrent requests from
      // spending provider credits more than once (including ambiguous retries).
      const claimed=await claimPilotSlot(env,user,job.id);
      if(!claimed){
        await updateJobStatus(env.WALLETS_DB,user.id,job.id,'failed',null,'pilot_one_generation_limit');
        return Response.json({job_id:job.id,status:'failed',error:'pilot_one_generation_limit'},{status:429});
      }
    }

    // The caller never receives the platform Muapi key.
    try {
      const response = await fetch('https://api.muapi.ai/api/v1/' + model.muapi_endpoint, {
        method: 'POST',
        headers: { 'x-api-key': env.MUAPI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(pricedInput),
      });
      if (response.status >= 400 && response.status < 500) {
        await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, 'upstream_rejected');
        return Response.json({ job_id: job.id, status: 'failed', error: 'upstream_rejected' }, { status: 422 });
      }
      if (!response.ok) throw new Error('upstream_ambiguous_response');
      const data = await response.json();
      const requestId = data.request_id || data.id;
      if (!requestId || typeof requestId !== 'string') throw new Error('upstream_missing_request_id');
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'submitted', requestId);
      return Response.json({
        job_id: job.id, status: 'submitted',
        customer_price_cents: model.customer_price_cents
      }, { status: 202 });
    } catch (error) {
      // Never release funds on ambiguous provider/network errors:
      // the provider may have accepted the expensive request.
      await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'unknown', null, 'manual_reconciliation_required');
      return Response.json({ job_id: job.id, status: 'unknown',
        message: 'Solicitud pendiente de conciliación; reserva retenida para evitar doble cargo.' }, { status: 202 });
    }
  } catch (error) {
    return jsonError(error);
  }
}
