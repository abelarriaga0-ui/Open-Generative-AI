'use client';
import {useState} from 'react';
import {downloadRealizoVideo} from '@/lib/realizo-creative/download-video';

const formattedDate=value=>{
 const normalized=String(value||'').replace(' ','T');
 const withZone=/Z$|[+-]\d{2}:\d{2}$/.test(normalized)?normalized:normalized+'Z';
 const stamp=Date.parse(withZone);
 return Number.isFinite(stamp)?new Date(stamp).toLocaleDateString('es-EC'):'';
};
const statusText=status=>({
 completed:'Completado',failed:'No completado',unknown:'En revisión',
 submitted:'En proceso',reserved:'Preparando',pending:'En espera'
})[status]||'En proceso';
const typeText={all:'Todos',video:'Videos',image:'Imágenes'};

export default function RealizoCreationsGallery({
 videos=[],images=[],loading=false,warning='',onCreateVideo,onCreateImage,onSaveVideoTemplate,onRefresh
}){
 const [filter,setFilter]=useState('all');
 const [downloading,setDownloading]=useState('');
 const [downloadProgress,setDownloadProgress]=useState('');
 const [downloadReady,setDownloadReady]=useState(null);
 const [savingTemplate,setSavingTemplate]=useState('');
 const [feedback,setFeedback]=useState('');
 const [error,setError]=useState('');
 const list=[
  ...videos.map(video=>({...video,kind:'video'})),
  ...images.map(image=>({...image,kind:'image'}))
 ].sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')) || String(b.id).localeCompare(String(a.id)));
 const count={all:list.length,video:videos.length,image:images.length};
 const filtered=filter==='all'?list:list.filter(item=>item.kind===filter);
 const pending=images.some(item=>['submitted','reserved','unknown'].includes(item.status));

 const saveTemplate=async item=>{
  if(!onSaveVideoTemplate||savingTemplate)return;
  setSavingTemplate(item.id);setError('');setFeedback('');
  try{
   const result=await onSaveVideoTemplate(item.id);
   setFeedback('Plantilla guardada: '+(result?.title||'video'));
  }catch(e){setError(e?.message||'No se pudo guardar la plantilla de video.');}
  finally{setSavingTemplate('');}
 };
 const download=async item=>{
  if(downloading)return;
  setDownloading(item.id);setError('');setDownloadProgress('Preparando tu video…');setDownloadReady(null);
  try{
   const file=await downloadRealizoVideo(item.id,{
    onProgress:({loaded,total})=>{
     const percent=total?Math.min(100,Math.round(loaded/total*100)):null;
     setDownloadProgress(percent!==null
      ?'Descargando '+percent+' %'
      :'Descargando '+(loaded/1048576).toFixed(1)+' MB');
    },directUrl:item.video_url
   });
   setDownloadReady({...file,jobId:item.id});
   setDownloadProgress('Archivo preparado.');
  }catch(e){setError(e?.message||'No fue posible descargar el video.');}
  finally{setDownloading('');}
 };

 return <div className="rc-library" aria-label="Biblioteca de videos e imágenes">
  <div className="rc-library-top">
   <div className="rc-filters" role="group" aria-label="Filtrar creaciones">
    {Object.keys(typeText).map(type=><button type="button" key={type}
      className={filter===type?'rc-active':''} aria-pressed={filter===type}
      onClick={()=>setFilter(type)}>{typeText[type]} <span>{count[type]}</span></button>)}
   </div>
   <button type="button" className="rc-refresh" onClick={onRefresh} disabled={loading}>↻ Actualizar</button>
  </div>
  {feedback&&<p role="status" className="rc-feedback">{feedback}</p>}
  {error&&<p role="alert" className="rc-error">{error}</p>}
  {warning&&<p role="alert" className="rc-warning">{warning}</p>}
  {pending&&!loading&&<p className="rc-processing-hint" role="status"><span className="rc-pulse"/> Hay imágenes en proceso. Puedes volver a esta sección y pulsar Actualizar.</p>}
  {loading?<div className="rc-loading" role="status"><span className="rc-spinner"/> Cargando tus creaciones…</div>:
   filtered.length===0?<div className="rc-empty">
    <span aria-hidden="true">✳</span>
    <h2>{filter==='all'?'Tu biblioteca comienza aquí':filter==='video'?'Todavía no tienes videos':'Todavía no tienes imágenes'}</h2>
    <p>Todo lo que generes con Realizo aparecerá en este espacio.</p>
    <div><button onClick={onCreateVideo} type="button">Crear video ↗</button>
     <button onClick={onCreateImage} type="button">Crear imagen ↗</button></div>
   </div>:
   <div className="rc-gallery">
    {filtered.map(item=><article key={item.kind+'-'+item.id} className="rc-card">
     <div className="rc-media">
      <span className={'rc-kind '+item.kind}>{item.kind==='image'?'◫ IMAGEN':'▷ VIDEO'}</span>
      {item.kind==='image'?
       (item.image_url?<img src={item.image_url} alt={item.config?.product_name||'Imagen publicitaria generada'} loading="lazy"/>:
        <div className="rc-media-placeholder"><span>✳</span>{statusText(item.status)}</div>):
       (item.video_url?<video src={item.video_url} controls playsInline preload="metadata"
         data-realizo-owned-video="true" controlsList="noremoteplayback noplaybackrate"
         disablePictureInPicture aria-label="Video generado con Realizo"/>:
        <div className="rc-media-placeholder"><span>▷</span>{statusText(item.status)}</div>)}
     </div>
     <div className="rc-card-body">
      <div className="rc-card-name">
       <strong title={item.kind==='image'?(item.config?.product_name||'Imagen publicitaria'):(item.model||'Video publicitario')}>
        {item.kind==='image'?(item.config?.product_name||'Imagen publicitaria'):(item.model||'Video publicitario')}
       </strong>
       <span className={'rc-status '+item.status}>{statusText(item.status)}</span>
      </div>
      <p className="rc-card-meta">{formattedDate(item.created_at)}{item.kind==='image'&&item.config?.aspect_ratio?' · '+item.config.aspect_ratio:''}</p>
      <div className="rc-actions">
       {item.kind==='image'?
        <>
         {item.image_url&&<a href={item.image_url} target="_blank" rel="noopener noreferrer" className="rc-primary">Ver imagen ↗</a>}
         <button type="button" onClick={onCreateImage} className="rc-secondary">Crear otra imagen</button>
        </>:
        <>
         {item.video_url&&<button type="button" disabled={Boolean(downloading)}
            onClick={()=>download(item)} className="rc-primary">{downloading===item.id?'Descargando…':'↓ Descargar video'}</button>}
         {item.can_save_template&&<button type="button" className="rc-secondary"
            disabled={Boolean(savingTemplate)} onClick={()=>saveTemplate(item)}>
             {savingTemplate===item.id?'Guardando…':'☆ Guardar plantilla'}
           </button>}
        </>}
      </div>
      {item.kind==='video'&&downloadReady?.jobId===item.id&&
       <p className="rc-ready"><a href={downloadReady.url} download={downloadReady.filename}>Descargar MP4 ahora</a></p>}
      {item.kind==='video'&&downloading===item.id&&
       <p className="rc-downloading" role="status">{downloadProgress}</p>}
     </div>
    </article>)}
   </div>}
 </div>;
}
