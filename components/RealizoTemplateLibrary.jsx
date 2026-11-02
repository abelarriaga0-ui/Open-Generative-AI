'use client';
import {useEffect,useRef,useState} from 'react';
import {AD_TEMPLATES} from '@/lib/realizo-creative/ad-templates';
import {TEMPLATE_PREVIEW_SRC,TEMPLATE_HOVER_SRC,TEMPLATE_POSTER_SRC} from '@/lib/realizo-creative/template-video-input';

export default function RealizoTemplateLibrary({onChoose,featured=false}){
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
    <div><span className="realizo-v11-eyebrow">PLANTILLAS REALES</span>
      <h2>Ve el video antes de elegirlo.</h2>
      <p>Acerca el cursor para reproducirlo. Al elegirlo, solo adaptas el producto.</p>
    </div><span className="realizo-v11-count">1 plantilla</span>
   </div>}
   {!featured&&<div className="realizo-template-filter"><span>Todos</span><span>UGC</span></div>}
   <div className="realizo-v11-cards">
    <article className="realizo-v11-card realizo-template-preview-card"
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
        <h3>{item.name}</h3><p>El anuncio original de NOIL + GODA.</p>
        <span className="realizo-v11-tag">✦ Plantilla maestra</span>
       </div>
      </div>
      {!featured&&<div className="realizo-v11-card-extra">
        <span>UGC · 30 segundos</span>
        <p>El mismo guion y montaje, adaptados únicamente a tu producto.</p>
      </div>}
      <button type="button" className="realizo-v11-use" onClick={()=>onChoose(item.id)}>Usar plantilla <span aria-hidden="true">→</span></button>
    </article>
   </div>
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
   {!featured&&<p className="realizo-v11-disclaimer">Es el anuncio original, no un video de ejemplo inventado. Muapi puede variar visualmente la nueva generación aunque conserve el prompt.</p>}
 </section>;
}
