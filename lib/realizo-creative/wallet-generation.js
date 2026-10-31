// The original VideoStudio constructs model-specific parameters.
// Realizo quotes and submits them using its server-side Muapi key and wallet.
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
export async function generateWithRealizoWallet(params,{signal,onSubmitted}={}) {
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
    body:JSON.stringify({model_id:model,input}),signal,
  });
  const quote = await quoteResponse.json().catch(()=>({}));
  if (!quoteResponse.ok) {
    const code = String(quote.error || 'quote_unavailable');
    if (code === 'unsupported_model' || code === 'unsupported_model_endpoint')
      throw new Error('Este modelo todavía no está disponible para generar videos.');
    if (code === 'invalid_media_reference')
      throw new Error('Vuelve a subir tus archivos desde Realizo antes de generar.');
    if (code === 'model_pricing_unavailable' || code === 'unsupported_price_estimator')
      throw new Error('No se pudo verificar la tarifa actual de este modelo.');
    throw new Error('No se pudo consultar el precio del video: ' + code);
  }
  if (!Number.isSafeInteger(quote.price_cents) || quote.price_cents <= 0)
    throw new Error('El precio del modelo no es válido.');
  if (!quote.affordable)
    throw new Error('Saldo insuficiente para el modelo. Costo: $'+(quote.price_cents/100).toFixed(2));
  const confirmMessage = [
    'Modelo: ' + model,
    'Precio de esta generación: $' + (quote.price_cents/100).toFixed(2) + ' USD',
    'Saldo actual: $' + (quote.available_cents/100).toFixed(2) + ' USD',
    '',
    '¿Confirmas la generación y el descuento de tus créditos?',
  ].join(String.fromCharCode(10));
  if (typeof window === 'undefined' || !window.confirm(confirmMessage))
    throw new Error('Generación cancelada. No se descontaron créditos.');

  const body = {
    model_id:model,input,
    idempotency_key:crypto.randomUUID(),
    max_price_cents:quote.price_cents,
  };
  const response = await fetch('/api/wallet/generate', {
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),signal,
  });
  const submitted = await response.json().catch(()=>({}));
  if (!response.ok) {
    if (submitted.error === 'insufficient_funds')
      throw new Error('No tienes suficientes créditos.');
    if (submitted.error === 'price_changed_confirm_again')
      throw new Error('El precio cambió; confirma una nueva cotización antes de generar.');
    if (submitted.error === 'pilot_image_or_prompt_invalid' || submitted.error === 'invalid_media_reference')
      throw new Error('La referencia ya no es válida. Vuelve a subir tu archivo antes de generar.');
    if (submitted.error === 'wallet_internal_error') {
      const phases=['environment','identity','pilot-authorization','request-body',
        'model-lookup','model-authorization','model-options','image-ownership',
        'wallet-reservation','pilot-slot','provider-request'];
      const phase=phases.includes(submitted.phase)?submitted.phase:'unknown';
      throw new Error('Fallo interno en etapa '+phase+'. Revisa tu saldo e historial.');
    }
    throw new Error('No se pudo iniciar la generación: ' + String(submitted.error || response.status));
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
    if (status.status==='failed')
      throw new Error('La generación falló; revisa la devolución de la reserva.');
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
