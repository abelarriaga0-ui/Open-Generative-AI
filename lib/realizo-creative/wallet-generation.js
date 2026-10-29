// This adapter preserves the original VideoStudio parameter builder but sends
// an authorized generation to the per-user wallet backend instead of BYOK.
export function extractGeneratedVideoUrl(data) {
  const result=data?.result||data;
  const candidates=[result?.url,result?.output_url,
    typeof result?.output==='string'?result.output:null,
    ...(Array.isArray(result?.outputs)?result.outputs:[]),
    ...(Array.isArray(result?.output)?result.output:[])];
  for(const candidate of candidates){
    const url=typeof candidate==='string'?candidate:
      typeof candidate?.url==='string'?candidate.url:
      typeof candidate?.video_url==='string'?candidate.video_url:null;
    if(url && /^https:\/\//.test(url))return url;
  }
  return null;
}
export async function generateWithRealizoWallet(params,{signal,onSubmitted}={}) {
  if(!params || typeof params.model!=='string')throw new Error('Modelo no válido.');
  const {model,...inputs}=params;
  // Never silently charge for a 5-second 480p clip when the UI requests
  // another resolution, duration or quality. The test tariff is fixed.
  if(model==='wan2.2-image-to-video' && (
    (inputs.duration != null && Number(inputs.duration)!==5) ||
    (inputs.resolution != null && String(inputs.resolution).toLowerCase()!=='480p') ||
    (inputs.quality != null && inputs.quality!=='medium') ||
    (inputs.aspect_ratio != null && !['16:9','9:16'].includes(inputs.aspect_ratio))
  ))throw new Error('Esta prueba de Wan 2.2 permite únicamente 5 segundos, 480p y calidad media.');
  // The original multi-model UI may supply provider-specific optional fields.
  // For Realizo's one-price Wan pilot send only its documented, billable keys;
  // server always owns the fixed duration, resolution and quality.
  const input=model==='wan2.2-image-to-video'
    ? {
        prompt:String(inputs.prompt||'').trim(),
        image_url:typeof inputs.image_url==='string' ? inputs.image_url :
          Array.isArray(inputs.images_list) ? inputs.images_list[0] : undefined,
        aspect_ratio:inputs.aspect_ratio==='9:16'?'9:16':'16:9',
      }
    : inputs;
  const body={model_id:model,input,idempotency_key:crypto.randomUUID()};
  const response=await fetch('/api/wallet/generate',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),signal,
  });
  const submitted=await response.json().catch(()=>({}));
  if(!response.ok) {
    if(submitted.error==='insufficient_funds')throw new Error('No tienes suficientes créditos.');
    if(submitted.error==='model_not_available')throw new Error('Esta configuración de modelo no tiene una tarifa habilitada.');
    if(submitted.error==='pilot_image_or_prompt_invalid')throw new Error('La referencia del producto ya no es válida. Vuelve a subir la imagen antes de generar.');
    if(submitted.error==='wallet_internal_error'){
      const phases=['environment','identity','pilot-authorization','request-body','model-lookup','model-authorization','model-options','image-ownership','wallet-reservation','pilot-slot','provider-request'];
      const phase=phases.includes(submitted.phase)?submitted.phase:'unknown';
      throw new Error('Fallo interno en la etapa '+phase+'. No se ha completado la generación; revisa tu saldo y el historial.');
    }
    throw new Error('No se pudo iniciar la generación: '+String(submitted.error||response.status));
  }
  if(submitted.status==='unknown')throw new Error('La solicitud necesita conciliación. Revisa tu saldo antes de volver a intentar.');
  if(!submitted.job_id)throw new Error('La generación no devolvió identificador.');
  onSubmitted?.(submitted.job_id);
  for(let attempt=0;attempt<240;attempt++){
    if(signal?.aborted)throw new Error('Consulta cancelada. El video puede seguir en proceso.');
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(resolve,3000);
      if(signal)signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new Error('Consulta cancelada'))},{once:true});
    });
    const statusResponse=await fetch('/api/wallet/jobs/'+encodeURIComponent(submitted.job_id),{
      credentials:'same-origin',cache:'no-store',signal,
    });
    const status=await statusResponse.json().catch(()=>({}));
    if(statusResponse.status===202 && status.polling_error)continue;
    if(!statusResponse.ok)throw new Error('No se pudo consultar el estado del video.');
    if(status.status==='failed')throw new Error('La generación falló; revisa la devolución de la reserva.');
    if(status.status==='completed'){
      const url=extractGeneratedVideoUrl(status);
      if(!url)throw new Error('Generación terminada sin URL de video disponible.');
      return {url,request_id:submitted.job_id,job_id:submitted.job_id};
    }
    if(status.status==='unknown')throw new Error('Estado pendiente de conciliación; no repitas el cobro.');
  }
  throw new Error('El video sigue procesándose. Conserva el identificador de trabajo para consultarlo más tarde.');
}
