// Realizo's only user-facing export action for completed, owned videos.
// Submit a real same-origin POST in direct response to the click. This lets the
// browser handle Content-Disposition: attachment natively, without an async
// Blob URL that some browsers ignore when user activation expires.
export function downloadRealizoVideo(jobId){
  if(typeof jobId!=='string'||!/^[a-f0-9-]{36}$/i.test(jobId))
    throw new Error('No se pudo identificar tu video.');
  if(typeof document==='undefined')throw new Error('Descarga no disponible.');
  const frame=document.createElement('iframe');
  const frameName='realizo-download-'+crypto.randomUUID();
  frame.name=frameName;
  frame.title='Descarga de Realizo';
  frame.hidden=true;
  frame.style.display='none';
  document.body.appendChild(frame);
  const form=document.createElement('form');
  form.method='POST';
  form.action='/api/realizo/jobs/'+encodeURIComponent(jobId)+'/download';
  form.target=frameName;
  form.style.display='none';
  const field=document.createElement('input');
  field.type='hidden';
  field.name='download';
  field.value='1';
  form.appendChild(field);
  document.body.appendChild(form);
  try{
    form.submit();
  }finally{
    form.remove();
    // The browser owns the download stream. Do not remove its frame immediately.
    setTimeout(()=>frame.remove(),120000);
  }
}
