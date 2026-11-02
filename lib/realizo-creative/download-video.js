// The sole download action for owned, completed Realizo videos.
// Never expose a third-party provider download link in the interface.
export async function downloadRealizoVideo(jobId){
  if(typeof jobId!=='string'||!/^[a-f0-9-]{36}$/i.test(jobId))
    throw new Error('No se pudo identificar tu video.');
  const res=await fetch('/api/realizo/jobs/'+encodeURIComponent(jobId)+'/download',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'
  });
  if(!res.ok){
    const data=await res.json().catch(()=>({}));
    throw new Error(data?.error==='video_not_available'?'El video todavía no está listo para descargar.':'No se pudo descargar el video.');
  }
  const blob=await res.blob();
  if(!blob.size)throw new Error('El archivo no está disponible.');
  const localUrl=URL.createObjectURL(blob);
  try{
    const a=document.createElement('a');
    a.href=localUrl;
    a.download='Realizo-'+jobId+'.mp4';
    a.hidden=true;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }finally{
    setTimeout(()=>URL.revokeObjectURL(localUrl),60000);
  }
}
