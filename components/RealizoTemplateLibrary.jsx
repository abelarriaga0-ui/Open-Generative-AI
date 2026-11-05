'use client';
import {useEffect,useRef,useState} from 'react';
import {AD_TEMPLATES} from '@/lib/realizo-creative/ad-templates';
import {USER_TEMPLATE_CATEGORIES} from '@/lib/realizo-creative/user-templates';
import {LUXURY_TEMPLATE_ID,LUXURY_TEMPLATE_SAMPLE_URL} from '@/lib/realizo-creative/luxury-product-only-template';
import {UGC15_TEMPLATE_ID,UGC15_TEMPLATE_SAMPLE_URL,UGC15_TEMPLATE_SAMPLE_EXPIRES} from '@/lib/realizo-creative/ugc15-omni-template';
import {TEMPLATE_PREVIEW_SRC,TEMPLATE_HOVER_SRC,TEMPLATE_POSTER_SRC} from '@/lib/realizo-creative/template-video-input';

export default function RealizoTemplateLibrary({onChoose,onChooseSaved,guest=false,featured=false}){
 const hover=useRef(null);
 const full=useRef(null);
 const [open,setOpen]=useState(false);
 const [hoverPlaying,setHoverPlaying]=useState(false);
 const [hoverFailed,setHoverFailed]=useState(false);
 const [fullFailed,setFullFailed]=useState(false);
 const [fullStarted,setFullStarted]=useState(false);
 const [loading,setLoading]=useState(false);
 const [paused,setPaused]=useState(true);
 const item=AD_TEMPLATES[0];
 const luxury=AD_TEMPLATES.find(t=>t.id===LUXURY_TEMPLATE_ID);
 const ugc15=AD_TEMPLATES.find(t=>t.id===UGC15_TEMPLATE_ID);
 const [ugc15PreviewFailed,setUgc15PreviewFailed]=useState(false);
 const ugc15PreviewValid=Date.now()<Date.parse(UGC15_TEMPLATE_SAMPLE_EXPIRES);
 const [luxuryPreviewFailed,setLuxuryPreviewFailed]=useState(false);
 const [personalTemplates,setPersonalTemplates]=useState([]);
 const [personalLoading,setPersonalLoading]=useState(false);
 const [personalError,setPersonalError]=useState('');
 const [activeCategory,setActiveCategory]=useState('todos');
 const [workingTemplate,setWorkingTemplate]=useState(null);
 const labels=Object.fromEntries(USER_TEMPLATE_CATEGORIES.map(x=>[x.id,x.label]));
 useEffect(()=>{
   if(guest||featured)return;
   let cancelled=false;
   setPersonalLoading(true);
   fetch('/api/realizo/user-templates',{credentials:'same-origin',cache:'no-store'})
     .then(async r=>{if(!r.ok)throw Error('No se pudieron cargar tus plantillas.');return r.json()})
     .then(j=>{if(!cancelled)setPersonalTemplates(Array.isArray(j.templates)?j.templates:[])})
     .catch(e=>{if(!cancelled)setPersonalError(e.message)})
     .finally(()=>{if(!cancelled)setPersonalLoading(false)});
   return ()=>{cancelled=true};
 },[featured,guest]);
 async function usePersonalTemplate(item){
   if(!onChooseSaved)return;
   setWorkingTemplate(item.id);setPersonalError('');
   try{await onChooseSaved(item);}
   catch(e){setPersonalError(e?.message||'No pudimos abrir esta plantilla.');}
   finally{setWorkingTemplate(null);}
 }
 async function deletePersonalTemplate(item){
   if(!window.confirm('¿Eliminar la plantilla "'+item.title+'"?'))return;
   setWorkingTemplate(item.id);setPersonalError('');
   try{
     const r=await fetch('/api/realizo/user-templates/'+encodeURIComponent(item.id),{
       method:'DELETE',credentials:'same-origin'
     });
     if(!r.ok)throw Error('No se pudo eliminar la plantilla.');
     setPersonalTemplates(list=>list.filter(x=>x.id!==item.id));
   }catch(e){setPersonalError(e.message)}
   finally{setWorkingTemplate(null);}
 }
 const blockSave=e=>e.preventDefault();

 const stopHover=()=>{
   const v=hover.current;
   if(v){v.pause();if(v.readyState>=1)try{v.currentTime=0;}catch{}}
   setHoverPlaying(false);
 };
 const playHover=()=>{
   if(open||hoverFailed)return;
   const v=hover.current;
   if(!v)return;
   v.muted=true;
   const p=v.play();
   if(p&&typeof p.catch==='function')p.catch(()=>{});
 };
 const close=()=>{
   if(full.current){full.current.pause();full.current.removeAttribute('src');full.current.load();}
   setOpen(false);setLoading(false);setFullStarted(false);setPaused(true);
   stopHover();
 };
 const show=()=>{
   stopHover();
   setFullFailed(false);setLoading(true);setFullStarted(false);setPaused(true);
   setOpen(true);
 };
 useEffect(()=>{
   if(!open||!full.current)return;
   const v=full.current;
   v.src=TEMPLATE_PREVIEW_SRC;
   v.load();
   const p=v.play();
   if(p&&typeof p.catch==='function')p.catch(()=>{setPaused(true);setLoading(false);});
   return ()=>v.pause();
 },[open]);
 useEffect(()=>{
   if(!open)return;
   const escape=e=>{if(e.key==='Escape')close()};
   document.addEventListener('keydown',escape);
   return ()=>document.removeEventListener('keydown',escape);
 },[open]);
 const toggle=()=>{
   const v=full.current;if(!v)return;
   if(v.paused){
     setLoading(true);
     const p=v.play();
     if(p&&typeof p.catch==='function')p.catch(()=>{setLoading(false);setPaused(true)});
   }else v.pause();
 };
 return <section className={'realizo-v11-library'+(featured?' realizo-v11-featured':'')} aria-label="Plantillas publicitarias">
   {!featured&&<div className="realizo-v11-lib-head">
    <div><span className="realizo-v11-eyebrow">PLANTILLAS REALES Y MIS PLANTILLAS</span>
      <h2>Explora. Elige. Crea.</h2>
    </div><span className="realizo-v11-count">{AD_TEMPLATES.length} plantillas</span>
   </div>}
   {!featured&&<div className="realizo-template-filter" role="group" aria-label="Filtrar plantillas">
    {[{id:'todos',label:'Todos'},...USER_TEMPLATE_CATEGORIES].map(category=>
      <button type="button" key={category.id}
        aria-pressed={activeCategory===category.id}
        onClick={()=>setActiveCategory(category.id)}
        className={'rounded-full px-4 py-2 text-xs font-semibold '+(activeCategory===category.id?'bg-[#EFAC75] text-[#261A35]':'bg-[#EDE3F5] text-[#604881]')}>
        {category.label}
      </button>)}
   </div>}
   <div className="realizo-v11-cards">
    {(activeCategory==='todos'||activeCategory==='ugc')&&<article className="realizo-v11-card realizo-template-preview-card"
      onMouseEnter={playHover} onMouseLeave={stopHover} onContextMenu={blockSave}>
      <div className="realizo-v11-image-link realizo-template-video-frame">
       <div className="realizo-v11-card-photo realizo-v11-photo-0" aria-hidden="true"/>
       {!hoverFailed&&<video ref={hover} src={TEMPLATE_HOVER_SRC} poster={TEMPLATE_POSTER_SRC}
         className={'realizo-template-preview-video'+(hoverPlaying?' is-playing':'')}
         muted loop playsInline preload="none" controlsList="nodownload noremoteplayback noplaybackrate"
         disablePictureInPicture onContextMenu={blockSave}
         onPlaying={()=>setHoverPlaying(true)} onPause={()=>setHoverPlaying(false)}
         onError={()=>setHoverFailed(true)}/>}
       <div className="realizo-v11-photo-fade"/>
       <span className="realizo-v11-duration">0:30</span>
       <button type="button" className="realizo-v11-play" aria-label="Ver el video completo con audio"
         onClick={show}>▶</button>
       <div className="realizo-v11-card-overlay">
        <h3>{item.name}</h3><p>UGC · 30 segundos</p>
        <span className="realizo-v11-tag">✦ Plantilla maestra</span>
       </div>
      </div>
      {!featured&&<div className="realizo-v11-card-extra">
        <span>UGC · 30 segundos</span>
        
      </div>}
      <button type="button" className="realizo-v11-use" onClick={()=>onChoose(item.id)}>Usar plantilla <span aria-hidden="true">→</span></button>
    </article>}
    {ugc15&&(activeCategory==='todos'||activeCategory==='ugc')&&<article className="realizo-v11-card realizo-template-preview-card" aria-label="UGC de venta de 15 segundos con Seedance 2 Omni">
      <div className="realizo-v11-image-link realizo-template-video-frame">
       <div className="realizo-v11-card-photo realizo-v11-photo-0" aria-hidden="true"/>
       {!ugc15PreviewFailed&&ugc15PreviewValid&&<video
        src={UGC15_TEMPLATE_SAMPLE_URL}
        className="realizo-template-preview-video is-playing"
        muted playsInline loop autoPlay preload="none"
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture onError={()=>setUgc15PreviewFailed(true)}
        aria-label="Video de ejemplo real UGC de 15 segundos"/>}
       <div className="realizo-v11-photo-fade"/>
       <span className="realizo-v11-duration">0:15</span>
       <div className="realizo-v11-card-overlay">
        <h3>{ugc15.name}</h3><p>UGC · 15 segundos · Voz continua</p>
        <span className="realizo-v11-tag">🎙️ Seedance 2 Omni</span>
       </div>
      </div>
      {!featured&&<div className="realizo-v11-card-extra"><span>15 s · 720p · High · 9:16</span></div>}
      <button type="button" className="realizo-v11-use" onClick={()=>onChoose(ugc15.id)}>
       Usar plantilla <span aria-hidden="true">→</span>
      </button>
    </article>}
    {luxury&&(activeCategory==='todos'||activeCategory==='cine_premium')&&<article className="realizo-v11-card realizo-template-preview-card" aria-label="Plantilla Luxury Film solo producto">
      <div className="realizo-v11-image-link realizo-template-video-frame">
        <div className="realizo-v11-card-photo realizo-v11-photo-1" aria-hidden="true"/>
        {!luxuryPreviewFailed&&<video
          src={LUXURY_TEMPLATE_SAMPLE_URL} className="realizo-template-preview-video is-playing"
          muted playsInline loop autoPlay preload="metadata"
          disablePictureInPicture controlsList="nodownload noremoteplayback noplaybackrate"
          onError={()=>setLuxuryPreviewFailed(true)} aria-label="Ejemplo Nippori de Luxury Film 8 segundos"/>}
        <div className="realizo-v11-photo-fade"/>
        <span className="realizo-v11-duration">0:08</span>
        <div className="realizo-v11-card-overlay">
          <h3>{luxury.name}</h3><p>Premium · 8 segundos · sin personas · sin voz</p>
          <span className="realizo-v11-tag">✧ 3 tomas · Realismo físico</span>
        </div>
      </div>
      {!featured&&<div className="realizo-v11-card-extra"><span>8 s · 720p · Veo 3.1 Referencias</span></div>}
      <button type="button" className="realizo-v11-use" onClick={()=>onChoose(luxury.id)}>
        Usar plantilla <span aria-hidden="true">→</span>
      </button>
    </article>}
   </div>
   {!featured&&!guest&&<section className="mt-9 space-y-4" aria-label="Mis plantillas">
     <div className="flex flex-wrap items-center justify-between gap-2">
       <div><h3 className="text-2xl font-extrabold text-[#31233B]">Mis plantillas</h3>
       <p className="text-sm text-[#786B86]">Privadas, clasificadas automáticamente y reutilizables sin volver a pagar por guardarlas.</p></div>
       <span className="text-xs font-semibold text-[#805F9E]">{personalTemplates.length}/100 guardadas</span>
     </div>
     {personalError&&<p role="alert" className="rounded-xl bg-[#FCE8E7] p-3 text-sm text-[#9E3636]">{personalError}</p>}
     {personalLoading?<p role="status" className="text-sm text-[#887990]">Cargando tus plantillas…</p>:
      personalTemplates.filter(t=>activeCategory==='todos'||t.category===activeCategory).length?
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
       {personalTemplates.filter(t=>activeCategory==='todos'||t.category===activeCategory).map(t=>
        <article key={t.id} className="rounded-2xl border border-[#E7D8E7] bg-white p-5 shadow-sm space-y-3">
         <span className="inline-flex rounded-full bg-[#F2E6F8] px-3 py-1 text-xs font-bold text-[#755199]">{labels[t.category]||'Otros'}</span>
         <h4 className="font-extrabold text-[#30263A]">{t.title}</h4>
         <p className="line-clamp-3 text-sm text-[#6F6377]">{t.description}</p>
         <p className="text-xs text-[#887B91]">{t.model_id}{t.duration_seconds?' · '+t.duration_seconds+' s':''}</p>
         <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" onClick={()=>usePersonalTemplate(t)} disabled={Boolean(workingTemplate)}
           className="rounded-xl bg-[#6E4BD2] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
           {workingTemplate===t.id?'Abriendo…':'Usar plantilla'}
          </button>
          <button type="button" onClick={()=>deletePersonalTemplate(t)} disabled={Boolean(workingTemplate)}
           className="text-xs font-semibold text-[#97575B] underline disabled:opacity-50">Eliminar</button>
         </div>
        </article>)}
      </div>:
      <p className="rounded-2xl border border-dashed border-[#D7C4DC] bg-[#FAF7FC] p-5 text-sm text-[#807184]">
       {personalTemplates.length?'No tienes plantillas en esta categoría.':'Tus creaciones guardadas aparecerán aquí. Usa “Guardar plantilla” en el editor o “Mis videos”.'}
      </p>}
   </section>}
   {open&&<div className="realizo-template-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close()}}>
    <div role="dialog" aria-modal="true" aria-label="Video original de la plantilla" onContextMenu={blockSave}>
      <div className="realizo-template-modal-top">
       <strong>UGC Vendedor · Video original</strong>
       <button type="button" aria-label="Cerrar vista previa" onClick={close}>✕</button>
      </div>
      <div className="realizo-template-safe-player">
       <div className={'realizo-template-loading-poster'+(fullStarted?' is-hidden':'')}
         style={{backgroundImage:"url('"+TEMPLATE_POSTER_SRC+"')"}} aria-hidden="true"/>
       <video ref={full} playsInline preload="auto" poster={TEMPLATE_POSTER_SRC}
         controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture
         onContextMenu={blockSave}
         onPlaying={()=>{setFullStarted(true);setLoading(false);setPaused(false)}}
         onWaiting={()=>setLoading(true)} onCanPlay={()=>setLoading(false)}
         onPause={()=>setPaused(true)} onError={()=>{setLoading(false);setFullFailed(true)}}/>
       {!fullStarted&&!fullFailed&&<div className="realizo-template-video-loading" role="status">
        <span className="realizo-template-video-spinner" aria-hidden="true"/>
        <span>{loading?'Cargando vista previa…':'Listo para reproducir'}</span>
       </div>}
       {fullFailed&&<div className="realizo-template-video-loading" role="alert">
        No se pudo cargar el video. Cierra y vuelve a abrir la vista previa.
       </div>}
       <div className="realizo-template-preview-mark" aria-hidden="true">realizo · vista previa</div>
       {!fullFailed&&<button type="button" className="realizo-template-play-toggle"
         aria-label={paused?"Reproducir":"Pausar"} onClick={toggle}
         disabled={loading&&!fullStarted}>{paused?'▶ Reproducir':'Ⅱ Pausar'}</button>}
      </div>
      <button type="button" className="realizo-v11-use" onClick={()=>{close();onChoose(item.id)}}>Usar esta plantilla →</button>
    </div>
   </div>}

 </section>;
}
