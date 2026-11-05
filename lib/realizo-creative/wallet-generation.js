
/**
 * An in-page, accessible confirmation section. No browser confirm, provider
 * branding or payment action is triggered until the customer opts in.
 */
export function confirmRealizoChargeInline({model,priceCents,availableCents,signal}){
  if(typeof document==='undefined')return Promise.resolve(false);
  return new Promise(resolve=>{
    const focus=document.activeElement;
    const host=focus?.closest?.('section,main,form') || document.querySelector('main') || document.body;
    const panel=document.createElement('section');
    panel.setAttribute('role','region');
    panel.setAttribute('aria-label','Confirmar costo de generación');
    panel.style.cssText='box-sizing:border-box;width:100%;max-width:540px;margin:16px auto;padding:22px;border:1px solid #b99ed0;border-radius:16px;background:#fff;color:#24182d;box-shadow:0 8px 32px rgba(40,30,70,.1);font:inherit';
    const title=document.createElement('h3'); title.textContent='Confirma tu video en Realizo';
    title.style.cssText='font-size:20px;font-weight:700;margin:0 0 14px';
    panel.append(title);
    for(const [label,value] of [
      ['Modelo',model],
      ['Precio máximo autorizado','$'+(priceCents/100).toFixed(2)+' USD'],
      ['Saldo disponible','$'+(availableCents/100).toFixed(2)+' USD']
    ]){
      const line=document.createElement('p');line.style.cssText='display:flex;justify-content:space-between;gap:12px;margin:8px 0';
      const name=document.createElement('span');name.textContent=label;
      const val=document.createElement('strong');val.textContent=value;
      line.append(name,val);panel.append(line);
    }
    const note=document.createElement('p');note.textContent='Solo se reservará el importe mostrado después de tu confirmación. Si cancelas, no se descontarán créditos.';
    note.style.cssText='font-size:13px;margin:14px 0;color:#625a68';panel.append(note);
    const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
    const accept=document.createElement('button');accept.type='button';accept.textContent='Confirmar y generar';
    accept.style.cssText='background:#7032a1;color:#fff;border:0;border-radius:10px;padding:12px 18px;cursor:pointer';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
    cancel.style.cssText='background:#f1eef4;color:#322738;border:0;border-radius:10px;padding:12px 18px;cursor:pointer';
    actions.append(accept,cancel);panel.append(actions);
    let settled=false;
    const done=value=>{
      if(settled)return;settled=true;
      signal?.removeEventListener('abort',onAbort);
      panel.remove();focus?.focus?.();resolve(value);
    };
    const onAbort=()=>done(false);
    accept.addEventListener('click',()=>done(true),{once:true});
    cancel.addEventListener('click',()=>done(false),{once:true});
    signal?.addEventListener('abort',onAbort,{once:true});
    host.append(panel);panel.scrollIntoView({block:'nearest',behavior:'smooth'});
    cancel.focus();
    if(signal?.aborted)done(false);
  });
}
// The original VideoStudio constructs model-specific parameters.
// Realizo quotes and submits them using its server-side Muapi key and wallet.
export function explainRealizoGenerationError(code) {
 const messages={
  generation_requires_video_reference:'Este modelo necesita un video de referencia. Sube un video o elige un modelo que admita fotografías.',
  generation_image_reference_invalid:'Este modelo no acepta la imagen de referencia seleccionada. Revisa el formato o elige otro modo.',
  generation_duration_invalid:'La duración seleccionada no está permitida para este modelo.',
  generation_quality_invalid:'La relación de aspecto o la resolución no es compatible con este modelo.',
  generation_parameters_invalid:'El modelo rechazó esta combinación de referencias y ajustes. Revisa su compatibilidad antes de intentarlo otra vez.',
  generation_prompt_invalid:'El modelo no admite el texto o la longitud del prompt. Reduce las instrucciones y vuelve a intentar.',
  generation_model_unavailable:'Muapi no reconoció la ruta de generación de este modelo. No se inició el video y la reserva se liberó. Actualiza Realizo e intenta de nuevo; si persiste, selecciona otro modelo.',
  generation_service_busy:'El servicio de generación está ocupado. Intenta nuevamente más tarde.',
  generation_service_auth_unavailable:'El servicio de generación no está configurado correctamente. Contacta con soporte de Realizo.',
  generation_service_balance_unavailable:'El servicio de generación está temporalmente indisponible. Contacta con soporte de Realizo.',
  generation_payload_too_large:'Los archivos o ajustes de generación superan el límite permitido.',
  generation_service_unavailable:'El servicio de generación no respondió correctamente. Revisa Mis videos antes de volver a intentar.',
  generation_content_rejected:'El proveedor rechazó el contenido por sus normas de seguridad. Revisa la idea o las referencias.',
  provider_failed:'El proveedor terminó la solicitud sin producir un video y no comunicó una causa verificable.',
  upstream_rejected:'El servicio rechazó la solicitud. Revisa los archivos y los ajustes del modelo; no se realizó la generación.'
 };
 return messages[String(code)]||'No se pudo iniciar el video. Revisa tus referencias y ajustes antes de intentarlo de nuevo.';
}
export function extractGeneratedVideoUrl(data) {
  const result = data?.result || data;
  const candidates = [
    result?.url, result?.output_url,
    typeof result?.output === 'string' ? result.output : null,
    ...(Array.isArray(result?.outputs) ? result.outputs : []),
    ...(Array.isArray(result?.output) ? result.output : []),
  ];
  for (const candidate of candidates) {
    const url = typeof candidate === 'string' ? candidate :
      typeof candidate?.url === 'string' ? candidate.url :
      typeof candidate?.video_url === 'string' ? candidate.video_url : null;
    if (url && /^https:\/\//.test(url)) return url;
  }
  return null;
}
export async function generateWithRealizoWallet(params,{signal,onSubmitted,creativeContext}={}) {
  if (!params || typeof params.model !== 'string')
    throw new Error('Modelo no válido.');
  const {model,...inputs} = params;
  const input = {...inputs};
  // Adapt the legacy image-list field without changing selected quality/cost.
  if (model === 'wan2.2-image-to-video' && !input.image_url &&
      Array.isArray(input.images_list) && input.images_list.length === 1) {
    input.image_url = input.images_list[0];
    delete input.images_list;
  }
  const quoteResponse = await fetch('/api/wallet/quote', {
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model_id:model,input,...(creativeContext?.project_id?{creative_context:creativeContext}:{})}),signal,
  });
  const quote = await quoteResponse.json().catch(()=>({}));
  if (!quoteResponse.ok) {
    const code = String(quote.error || 'quote_unavailable');
    if(code==='premium_brief_reapproval_required'||code==='premium_cast_contract_missing'||code==='premium_audio_contract_missing')
      throw new Error('La configuración Premium de personas o voces no coincide con la versión aprobada. Vuelve al proyecto y aprueba el video sin repetir ni pagar la investigación; no se reservaron créditos.');
    if (code === 'muapi_generation_route_not_found')
      throw new Error('Muapi no publica una ruta de generación operativa para este modelo. No se reservaron créditos. Elige otra variante o consulta su disponibilidad.');
    if (code === 'muapi_generation_route_unverifiable')
      throw new Error('No fue posible comprobar la ruta de este modelo en Muapi. No se reservaron créditos; inténtalo cuando responda el proveedor.');
    if (code === 'unsupported_model' || code === 'unsupported_model_endpoint')
      throw new Error('Este modelo todavía no está disponible para generar videos.');
    if (code === 'invalid_media_reference')
      throw new Error('Vuelve a subir tus archivos desde Realizo antes de generar.');
    if(code==='model_reference_images_required'||code==='model_reference_images_invalid')
      throw new Error('Este modo necesita una fotografía de referencia válida. Vuelve a subirla antes de generar; no se cobraron créditos.');
    if(code==='model_reference_fields_conflict'||code==='model_input_fields_unsupported')
      throw new Error('Este modelo no admite algunos ajustes o referencias seleccionados. Cambia a su modo compatible; no se cobraron créditos.');
    if(code==='model_prompt_required')
      throw new Error('Escribe una descripción del video antes de generar; no se cobraron créditos.');
 
    if(code==='model_requires_video_reference' || code==='muapi_pricing_contract_mismatch')
      throw new Error('Este modelo no admite esta combinación de referencias y ajustes. Revisa si requiere un video de referencia. No se ha descontado nada.');
    if (code === 'provider_price_inputs_invalid')
      throw new Error('La configuración elegida no es compatible con este modelo. Revisa los archivos, duración y resolución; no se descontaron créditos.');
    if (code === 'muapi_rate_limited')
      throw new Error('El servicio está ocupado temporalmente. Inténtalo nuevamente; no se ha descontado nada.');
    if (code === 'model_pricing_unavailable' || code === 'unsupported_price_estimator' ||
        code === 'muapi_catalog_unavailable' || code === 'muapi_catalog_invalid')
      throw new Error('No pudimos obtener el precio del video. No se hizo ningún cargo. Puedes intentarlo nuevamente.');
    throw new Error('No se pudo verificar el costo de la generación. No se cobraron créditos.');
  }
  if (!Number.isSafeInteger(quote.price_cents) || quote.price_cents <= 0)
    throw new Error('El precio del modelo no es válido.');
  if (!quote.affordable)
    throw new Error('Saldo insuficiente para el modelo. Costo: $'+(quote.price_cents/100).toFixed(2));
  if (typeof document === 'undefined' ||
      !await confirmRealizoChargeInline({
        model, priceCents:quote.price_cents, availableCents:quote.available_cents, signal
      }))
    throw new Error('Generación cancelada. No se descontaron créditos.');

  const body = {
    model_id:model,input,
    idempotency_key:crypto.randomUUID(),
    max_price_cents:quote.price_cents,
    ...(creativeContext?.project_id?{creative_context:creativeContext}:{}),
  };
  const response = await fetch('/api/wallet/generate', {
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),signal,
  });
  const submitted = await response.json().catch(()=>({}));
  if (!response.ok) {
    if(submitted.error==='premium_brief_reapproval_required'||submitted.error==='premium_cast_contract_missing'||submitted.error==='premium_audio_contract_missing')
      throw new Error('La configuración Premium de audio o personas no coincide con la versión aprobada. Revísala y aprueba de nuevo antes de pagar; no se ha generado ni cobrado.');
    if (submitted.error === 'insufficient_funds')
      throw new Error('No tienes suficientes créditos.');
    if (submitted.error === 'price_changed_confirm_again')
      throw new Error('El precio cambió; confirma una nueva cotización antes de generar.');
    if (submitted.error === 'pilot_image_or_prompt_invalid' || submitted.error === 'invalid_media_reference')
      throw new Error('La referencia ya no es válida. Vuelve a subir tu archivo antes de generar.');
    // Keep the exact, public model ID in the diagnostic so a provider 404
    // can be investigated without exposing API keys, media URLs or wallet data.
    if(submitted.error==='muapi_generation_route_not_found'||submitted.error==='muapi_generation_route_unverifiable')
      throw new Error('Muapi no confirmó la ruta de generación del modelo '+model+'. No se reservó ningún crédito.');
    if(submitted.error==='generation_model_unavailable')
      throw new Error('Muapi respondió 404 al iniciar '+model+'. No se generó el video; la reserva se liberó. No repitas el pago si hay una solicitud pendiente.');
    if (String(submitted.error||'').startsWith('generation_')||submitted.error==='upstream_rejected')
      throw new Error(explainRealizoGenerationError(submitted.error));
    if (submitted.error === 'wallet_internal_error') {
      const phases=['environment','identity','pilot-authorization','request-body',
        'model-lookup','model-authorization','model-options','image-ownership',
        'wallet-reservation','pilot-slot','provider-request'];
      const phase=phases.includes(submitted.phase)?submitted.phase:'unknown';
      throw new Error('Fallo interno en etapa '+phase+'. Revisa tu saldo e historial.');
    }
    throw new Error(explainRealizoGenerationError(submitted.error));
  }
  if (submitted.status === 'unknown')
    throw new Error('Solicitud pendiente de conciliación. No repitas el cobro.');
  if (!submitted.job_id)
    throw new Error('La generación no devolvió identificador.');
  onSubmitted?.(submitted.job_id);

  for (let attempt=0;attempt<240;attempt++) {
    if (signal?.aborted)
      throw new Error('Consulta cancelada. El video puede seguir en proceso.');
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(resolve,3000);
      if (signal)
        signal.addEventListener('abort',()=>{
          clearTimeout(timer);reject(new Error('Consulta cancelada'));
        },{once:true});
    });
    const statusResponse=await fetch('/api/wallet/jobs/'+encodeURIComponent(submitted.job_id),{
      credentials:'same-origin',cache:'no-store',signal,
    });
    const status=await statusResponse.json().catch(()=>({}));
    if (statusResponse.status===202 && status.polling_error)continue;
    if (!statusResponse.ok)
      throw new Error('No se pudo consultar el estado del video.');
    if (status.status==='failed'){
      const detail=explainRealizoGenerationError(status.failure_code||'provider_failed');
      const settlement=status.release_confirmed===true
        ?'La devolución de créditos quedó confirmada en la billetera.'
        :'No se pudo verificar todavía la devolución. Comprueba Mis créditos antes de volver a generar.';
      throw new Error(detail+' '+settlement+' Solicitud: '+submitted.job_id+'.');
    }
    if (status.status==='completed') {
      const url=extractGeneratedVideoUrl(status);
      if (!url)throw new Error('Generación terminada sin URL de video disponible.');
      return {url,request_id:submitted.job_id,job_id:submitted.job_id};
    }
    if (status.status==='unknown')
      throw new Error('Estado pendiente de conciliación; no repitas el cobro.');
  }
  throw new Error('El video sigue procesándose. Consúltalo en Mis videos.');
}
