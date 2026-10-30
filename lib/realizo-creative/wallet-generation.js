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
  // Preserve the model, duration, resolution and quality selected in the
  // original editor. Normalize only the legacy Wan image field if needed.
  const {model,...inputs}=params;
  const input = {...inputs};
  if(model==='wan2.2-image-to-video' && !input.image_url &&
      Array.isArray(input.images_list) && input.images_list.length===1) {
    input.image_url=input.images_list[0];
    delete input.images_list;
  }
  // Quote before any reservation. Do not silently charge at a fixed pilot
  // rate when the user selected a different model or premium resolution.
  const quoteResponse=await fetch('/api/wallet/quote',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model_id:model,input}),signal,
  });
  const quote=await quoteResponse.json().catch(()=>({}));
  if(!quoteResponse.ok) {
    const code=String(quote.error||'quote_unavailable');
    if(code==='unsupported_model' || code==='unsupported_model_endpoint')
      throw new Error('Este modelo aún no tiene un endpoint de video compatible en Muapi.');
    if(code==='invalid_media_reference')
      throw new Error('Vuelve a subir las imágenes o videos desde Realizo antes de generar.');
    if(code==='model_pricing_unavailable' || code==='unsupported_price_estimator')
      throw new Error('Muapi todavía no proporciona una tarifa verificable para este modelo.');
    throw new Error('No se pudo consultar el precio de Muapi: '+code);
  }
  if(!quote.affordable || !Number.isSafeInteger(quote.price_cents))
    throw new Error('Saldo insuficiente para este modelo. Precio: 
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body),signal,
  });
  const submitted=await response.json().catch(()=>({}));
  if(!response.ok) {
    if(submitted.error==='insufficient_funds')throw new Error('No tienes suficientes créditos.');
    if(submitted.error==='model_not_available')throw new Error('Esta configuración de modelo no tiene una tarifa habilitada.');
    if(submitted.error==='price_changed_confirm_again')throw new Error('El precio cambió; confirma una nueva cotización antes de generar.');
    if(submitted.error==='unsupported_model' || submitted.error==='model_pricing_unavailable')throw new Error('Muapi no ha confirmado un precio válido para este modelo.');
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
+(quote.price_cents/100).toFixed(2));
  const confirmation=typeof window!=='undefined' && window.confirm(
    'Modelo: '+model+'\\nPrecio de esta generación: 
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
+
    (quote.price_cents/100).toFixed(2)+' USD\\nSaldo actual: 
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
+
    (quote.available_cents/100).toFixed(2)+
    ' USD\\n\\n¿Confirmas la generación y el descuento de tus créditos?'
  );
  if(!confirmation)throw new Error('Generación cancelada. No se descontaron créditos.');
  const body={model_id:model,input,idempotency_key:crypto.randomUUID(),
    max_price_cents:quote.price_cents};
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
