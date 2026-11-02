// Download only completed videos owned by the signed-in Realizo user.
// A same-origin POST keeps the provider URL private and returns actionable
// errors rather than silently navigating a hidden iframe on HTTP failures.
const ERROR_MESSAGES=Object.freeze({
  not_authenticated:'Tu sesión terminó. Inicia sesión en Realizo para descargar este video.',
  invalid_origin:'La sesión cambió. Recarga Realizo e inténtalo nuevamente.',
  invalid_job_id:'No se pudo identificar este video.',
  job_not_found:'Este video ya no está disponible en tu biblioteca.',
  video_not_available:'El video aparece completado, pero el archivo todavía no está disponible para descarga. Contacta a soporte de Realizo con la fecha del video.',
  video_unavailable:'No pudimos recuperar el archivo del video. Prueba nuevamente sin generar ni pagar otro video.',
  provider_video_response_invalid:'El archivo de video todavía no está listo para descargar. Prueba nuevamente.',
  wallet_internal_error:'No pudimos preparar la descarga. Prueba nuevamente o contacta a soporte.',
});
const MAX_FILE_BYTES=500_000_000;

export async function downloadRealizoVideo(jobId,{onProgress,directUrl}={}){
  if(typeof jobId!=='string'||!/^[a-f0-9-]{36}$/i.test(jobId))
    throw new Error('No se pudo identificar tu video.');
  if(typeof document==='undefined'||typeof URL.createObjectURL!=='function')
    throw new Error('Este navegador no permite preparar la descarga.');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10*60*1000);
  let response;
  try{
    response=await fetch('/api/realizo/jobs/'+encodeURIComponent(jobId)+'/download',{
      method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{Accept:'video/mp4, application/json'},signal:controller.signal,
    });
    if(!response.ok){
      const error=await response.json().catch(()=>({}));
      const code=typeof error?.error==='string'?error.error:'';
      // A completed, owned job already exposes its playable source to the
      // signed-in user's player. If Worker egress fails, the browser can try
      // downloading that same media directly when the CDN permits CORS.
      // Never send cookies or authorization to the media host.
      if(response.status===502&&code==='video_unavailable'&&typeof directUrl==='string'){
        let valid=false;
        try{
          const url=new URL(directUrl);
          valid=url.protocol==='https:'&&url.hostname==='cdn.muapi.ai'&&
            /^\/outputs\/[a-zA-Z0-9/_-]+\.mp4$/.test(url.pathname)&&!url.search&&!url.hash;
        }catch{}
        if(valid){
          try{
            const browserCopy=await fetch(directUrl,{
              method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
              headers:{Range:'bytes=0-'},signal:controller.signal
            });
            if(browserCopy.ok)response=browserCopy;
            else await browserCopy.body?.cancel?.();
          }catch{}
        }
      }
      if(!response.ok){
        const status=Number.isInteger(error?.provider_status)?error.provider_status:0;
        const suffix=status===404||status===410
          ?' El enlace de origen puede haber caducado. Si todavía puedes reproducir el video, guárdalo desde su reproductor.'
          :' Si el video se reproduce, utiliza el menú del reproductor para guardarlo.';
        throw new Error((ERROR_MESSAGES[code]||('La descarga no pudo completarse (error '+response.status+'). No se te ha cobrado nuevamente.'))+suffix);
      }
    }
    const mime=(response.headers.get('content-type')||'').toLowerCase();
    if(!mime.includes('video/mp4')&&!mime.includes('application/octet-stream'))
      throw new Error('La respuesta no contiene un video válido. No se descargó ningún archivo.');
    const declared=Number(response.headers.get('content-length')||0);
    if(declared>MAX_FILE_BYTES)
      throw new Error('Este video supera el tamaño de descarga permitido. Contacta a soporte de Realizo.');
    let blob;
    if(response.body?.getReader){
      const chunks=[];
      let loaded=0;
      const reader=response.body.getReader();
      while(true){
        const {done,value}=await reader.read();
        if(done)break;
        if(!value?.length)continue;
        loaded+=value.length;
        if(loaded>MAX_FILE_BYTES){
          await reader.cancel();
          throw new Error('Este video supera el tamaño de descarga permitido. Contacta a soporte de Realizo.');
        }
        chunks.push(value);
        onProgress?.({loaded,total:declared||null});
      }
      blob=new Blob(chunks,{type:'video/mp4'});
    }else{
      blob=await response.blob();
      onProgress?.({loaded:blob.size,total:blob.size});
    }
    if(!blob.size||blob.size>MAX_FILE_BYTES)
      throw new Error('El archivo recibido está vacío o supera el tamaño permitido.');
    const url=URL.createObjectURL(blob);
    const filename='realizo-'+jobId+'.mp4';
    try{
      const link=document.createElement('a');
      link.href=url;
      link.download=filename;
      link.style.display='none';
      document.body.appendChild(link);
      try{link.click();}finally{link.remove();}
    }catch{
      // The caller displays a manual user-activated download link.
    }
    // Preserve the fallback link long enough for the customer to click.
    const expiry=setTimeout(()=>URL.revokeObjectURL(url),15*60*1000);
    expiry?.unref?.();
    return {url,filename};
  }catch(error){
    if(error?.name==='AbortError')
      throw new Error('La descarga excedió el tiempo disponible. Inténtalo nuevamente; el video sigue guardado.');
    if(error instanceof TypeError)
      throw new Error('No pudimos conectar con Realizo para descargar el video. Comprueba tu conexión e inténtalo nuevamente.');
    throw error;
  }finally{
    clearTimeout(timer);
  }
}
