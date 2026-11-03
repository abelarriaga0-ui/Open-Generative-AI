import {
  getWalletEnvironment, requireWalletUser, getPricedModel,
  createReservedJob, updateJobStatus, jsonError
} from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { isMuapiGenerationEnabled } from '@/lib/wallet/generation-policy';
import {isPilotAccount,claimPilotSlot,isPilotPriceConfigValid,isOwnedSignedProductImage,PILOT_MODEL_ID} from '@/lib/wallet/muapi-pilot';
import { isAllowedMuapiEndpoint } from '@/lib/wallet/muapi-endpoint';
import {isOwnerMultiModelSandbox} from '@/lib/wallet/multi-model-access';
import {quoteLiveVideo,ensureOwnedMedia,userFacingQuoteError,normalizeLiveVideoInput} from '@/lib/wallet/live-video-models';
import {verifyPremiumGeneration} from '@/lib/realizo-creative/premium-generation-gate';
import {applyRealismToVideoInput} from '@/lib/realizo-creative/video-realism';

export const dynamic = 'force-dynamic';

function classifyRejectedGeneration(status, detail) {
  const safe = typeof detail === 'object' && detail !== null ? detail : {};
  // The upstream error may be arbitrary user content. Interpret known fields,
  // but never return or log raw upstream response text.
  const error=safe.error;
  const fields=Array.isArray(safe.detail)?safe.detail.flatMap(d=>Array.isArray(d?.loc)?d.loc.map(String):[]):[];
  const payload= [
    typeof error === 'string' ? error : '',
    typeof error?.message === 'string' ? error.message : '',
    typeof error?.code === 'string' ? error.code : '',
    typeof safe.detail === 'string' ? safe.detail : '',
    typeof safe.message === 'string' ? safe.message : ''
  ].join(' ').toLowerCase().slice(0,1400);
  if(fields.some(f=>/^(?:image_urls|images_list|image_url|first_frame_url|reference_image_urls)$/.test(f)))
    return 'generation_image_reference_invalid';
  if(fields.includes('duration'))return 'generation_duration_invalid';
  if(fields.includes('resolution')||fields.includes('aspect_ratio'))return 'generation_quality_invalid';
  if(fields.includes('prompt'))return 'generation_prompt_invalid';
  if (status === 401 || status === 403) return 'generation_service_auth_unavailable';
  if (status === 402) return 'generation_service_balance_unavailable';
  if (status === 404) return 'generation_model_unavailable';
  if (status === 429) return 'generation_service_busy';
  if (/video_url|video reference|reference video|video input|video required/.test(payload))
    return 'generation_requires_video_reference';
  if (/image_url|images_list|image reference|unsupported image|reference image/.test(payload))
    return 'generation_image_reference_invalid';
  if (/duration|seconds|length/.test(payload)) return 'generation_duration_invalid';
  if (/resolution|aspect_ratio|aspect ratio|size/.test(payload)) return 'generation_quality_invalid';
  if (/quota|insufficient credit|insufficient balance/.test(payload))
    return 'generation_service_balance_unavailable';
  if (status === 413) return 'generation_payload_too_large';
  if (status === 400 || status === 422) return 'generation_parameters_invalid';
  return 'generation_service_unavailable';
}


function validInput(input) {
  return input && typeof input === 'object' && !Array.isArray(input) &&
    !Object.keys(input).some(key => /^(webhook|webhook_url|callback_url|api_key|x-api-key)$/i.test(key));
}

export async function POST(request) {
  if (!enforceSameOrigin(request)) {
    return Response.json({ error: 'invalid_origin' }, { status: 403 });
  }
  let phase='environment';
  try {
    const env = await getWalletEnvironment();
    phase='identity';
    const user = await requireWalletUser(request, env);
    if (!user) return Response.json({ error: 'not_authenticated' }, { status: 401 });
    phase='pilot-authorization';
    if (!isMuapiGenerationEnabled(env,user)) {
      return Response.json({ error: 'generation_disabled_in_test_environment' }, { status: 503 });
    }
    if (!env.MUAPI_API_KEY) {
      return Response.json({ error: 'muapi_secret_not_configured' }, { status: 503 });
    }
    if (Number(request.headers.get('content-length') || 0) > 131072) {
      return Response.json({ error: 'payload_too_large' }, { status: 413 });
    }
    phase='request-body';
    const body = await request.json();
    if (!validInput(body?.input) || JSON.stringify(body.input).length > 131072 ||
        typeof body?.model_id !== 'string' || body.model_id.length > 100 ||
        typeof body?.idempotency_key !== 'string' ||
        !/^[A-Za-z0-9_-]{8,128}$/.test(body.idempotency_key)) {
      return Response.json({ error: 'invalid_generation_request' }, { status: 400 });
    }
    const premiumError=await verifyPremiumGeneration(env.WALLETS_DB,user.id,body.model_id,body.input,body.creative_context);
    if(premiumError)return Response.json({error:premiumError},{status:422});
    // Enforce the same video realism contract used during the price quote.
    const renderInput=applyRealismToVideoInput(body.input);
    phase='model-lookup';
    const pilot=env.REALIZO_ENV==='sandbox';
    const multiModel=!pilot || await isOwnerMultiModelSandbox(env,user);
    let model;
    if (multiModel) {
      // Recalculate the price from the provider for this exact payload.
      // Never accept a client-supplied price or an arbitrary provider endpoint.
      let quote;
      try {
        await ensureOwnedMedia(env,user,renderInput);
        quote=await quoteLiveVideo(body.model_id,renderInput,env.MUAPI_API_KEY);
      } catch(err) {
        return Response.json({error:userFacingQuoteError(err)},{status:422});
      }
      const customerPriceCents=Math.max(quote.provider_cost_cents+1,Math.ceil(quote.provider_cost_cents*1.05));
      if(!Number.isSafeInteger(body.max_price_cents) ||
         body.max_price_cents<=0 || customerPriceCents>body.max_price_cents) {
        return Response.json({error:'price_changed_confirm_again'},{status:409});
      }
      // The foreign key for generation_jobs requires a catalog model row.
      // Price for THIS job is exclusively the current live estimate, not an
      // old shared catalog price that could be changed by another request.
      await env.WALLETS_DB.prepare(
        'INSERT OR IGNORE INTO model_prices (model_id,muapi_endpoint,customer_price_cents,enabled,allowed_input_keys_json,fixed_options_json) VALUES (?,?,?,1,?,?)'
      ).bind(quote.model_id,quote.endpoint,customerPriceCents,
        JSON.stringify(Object.keys(body.input)), '{}').run();
      // Muapi may change a model's public endpoint without changing its
      // model ID (e.g. Seedance 2 Omni Reference gained ".0" in the slug).
      // Update ONLY the trusted live-catalog endpoint before reserving funds.
      // Do not trust any endpoint or price supplied by the browser.
      await env.WALLETS_DB.prepare(
        'UPDATE model_prices SET muapi_endpoint=?, updated_at=datetime(\'now\') WHERE model_id=? AND muapi_endpoint<>?'
      ).bind(quote.endpoint,quote.model_id,quote.endpoint).run();
      const recorded=await env.WALLETS_DB.prepare(
        'SELECT muapi_endpoint FROM model_prices WHERE model_id=?'
      ).bind(quote.model_id).first();
      if(recorded?.muapi_endpoint!==quote.endpoint)
        return Response.json({error:'model_endpoint_conflict'},{status:409});
      model={model_id:quote.model_id,muapi_endpoint:quote.endpoint,
        customer_price_cents:customerPriceCents,
        allowed_input_keys_json:JSON.stringify(Object.keys(body.input)),
        fixed_options_json:'{}'};
    } else {
      model=await getPricedModel(env.WALLETS_DB,body.model_id);
      if (!model) return Response.json({error:'model_not_available'},{status:404});
    }
    phase='model-authorization';
    if (pilot && !multiModel && (!isPilotAccount(env,user) ||
       !isPilotPriceConfigValid(model) || body.model_id!==PILOT_MODEL_ID)) {
      return Response.json({error:'pilot_model_not_allowed'},{status:403});
    }
    if (!isAllowedMuapiEndpoint(model.muapi_endpoint)) {
      throw new Error('invalid_configured_endpoint');
    }
    // The buyer cannot override expensive duration, size, quality or resolution fields.
    // Operators must define separate priced model variants for those options.
    phase='model-options';
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
    phase='image-ownership';
    if(pilot && !multiModel){
      const url=body.input.image_url;
      if(!await isOwnedSignedProductImage(env,user,url) ||
         typeof body.input.prompt!=='string'||body.input.prompt.trim().length<5||
         body.input.prompt.length>6000 ||
         !['16:9','9:16'].includes(body.input.aspect_ratio||'16:9')) {
        return Response.json({error:'pilot_image_or_prompt_invalid'},{status:400});
      }
    }
    // Match the exact documented reference fields used during price estimation.
    // Unsupported inputs fail before provider billing; do not auto-switch models.
    let pricedInput;
    try{
      pricedInput=normalizeLiveVideoInput(body.model_id,{...renderInput,...fixed});
    }catch(err){
      return Response.json({error:userFacingQuoteError(err)},{status:422});
    }

    phase='wallet-reservation';
    const job = await createReservedJob(env.WALLETS_DB, {
      userId: user.id,
      modelId: model.model_id,
      priceCents: model.customer_price_cents,
      idempotencyKey: body.idempotency_key,
    });
    if (!job.newlyCreated) {
      return Response.json({ job_id: job.id, status: job.status, idempotent: true });
    }
    if(pilot && !multiModel){
      // A single D1 primary-key slot prevents concurrent requests from
      // spending provider credits more than once (including ambiguous retries).
      phase='pilot-slot';
      const claimed=await claimPilotSlot(env,user,job.id);
      if(!claimed){
        await updateJobStatus(env.WALLETS_DB,user.id,job.id,'failed',null,'pilot_one_generation_limit');
        return Response.json({job_id:job.id,status:'failed',error:'pilot_one_generation_limit'},{status:429});
      }
    }

    phase='provider-request';
    // The caller never receives the platform Muapi key.
    try {
      const response = await fetch('https://api.muapi.ai/api/v1/' + model.muapi_endpoint, {
        method: 'POST',
        headers: { 'x-api-key': env.MUAPI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(pricedInput),
      });
      if (response.status >= 400 && response.status < 500) {
        const detail=await response.json().catch(()=>({}));
        const failure=classifyRejectedGeneration(response.status,detail);
        await updateJobStatus(env.WALLETS_DB, user.id, job.id, 'failed', null, failure);
        return Response.json({job_id:job.id,status:'failed',error:failure},{status:422});
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
    const generic=jsonError(error);
    if(generic.status===500){
      // Public phase names are a fixed allowlist, never exception messages,
      // SQL, account IDs or provider secrets.
      console.warn('Realizo wallet generation failure phase='+phase);
      return Response.json({error:'wallet_internal_error',phase},{status:500,
        headers:{'Cache-Control':'no-store'}});
    }
    return generic;
  }
}
