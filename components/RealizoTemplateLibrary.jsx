'use client';
import {useRef,useState} from 'react';
import {AD_TEMPLATES} from '@/lib/realizo-creative/ad-templates';
import {TEMPLATE_PREVIEW_SRC,TEMPLATE_PREVIEW_PROVIDER_SRC} from '@/lib/realizo-creative/template-video-input';

export default function RealizoTemplateLibrary({onChoose,featured=false}){
 const preview=useRef(null);
 const [open,setOpen]=useState(false);
 const [source,setSource]=useState(TEMPLATE_PREVIEW_SRC);
 const [failed,setFailed]=useState(false);
 const [playing,setPlaying]=useState(false);
 const item=AD_TEMPLATES[0];
 const enter=()=>{if(preview.current&&!failed){preview.current.muted=true;preview.current.currentTime=0;
  preview.current.play().then(()=>setPlaying(true)).catch(()=>setPlaying(false));}};
 const leave=()=>{if(preview.current){preview.current.pause();preview.current.currentTime=0;}setPlaying(false);};
 function error(){
  if(source!==TEMPLATE_PREVIEW_PROVIDER_SRC){setSource(TEMPLATE_PREVIEW_PROVIDER_SRC);return;}
  setFailed(true);setPlaying(false);
 }
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
      onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave}>
      <div className="realizo-v11-image-link realizo-template-video-frame">
       <div className="realizo-v11-card-photo realizo-v11-photo-0" aria-hidden="true"/>
       {!failed&&<video ref={preview} src={source} poster="/assets/realizo/templates/ugc-master-30s.jpg"
         className={'realizo-template-preview-video'+(playing?' is-playing':'')}
         muted loop playsInline preload="metadata" onError={error}/>}
       <div className="realizo-v11-photo-fade"/>
       <span className="realizo-v11-duration">0:30</span>
       <button type="button" className="realizo-v11-play" aria-label="Ver el video completo con audio"
         onClick={()=>{leave();setOpen(true)}}>▶</button>
       <div className="realizo-v11-card-overlay">
        <h3>{item.name}</h3>
        <p>El anuncio original de NOIL + GODA.</p>
        <span className="realizo-v11-tag">✦ Plantilla maestra</span>
       </div>
      </div>
      {!featured&&<div className="realizo-v11-card-extra">
        <span>UGC · 30 segundos</span>
        <p>El mismo guion y montaje, adaptados únicamente a tu producto.</p>
      </div>}
      <button type="button" className="realizo-v11-use" onClick={()=>onChoose(item.id)}>
        Usar plantilla <span aria-hidden="true">→</span>
      </button>
    </article>
   </div>
   {open&&<div className="realizo-template-modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <div role="dialog" aria-modal="true" aria-label="Video original de la plantilla">
      <div className="realizo-template-modal-top">
       <strong>UGC Vendedor · Video original</strong>
       <button type="button" aria-label="Cerrar vista previa" onClick={()=>setOpen(false)}>✕</button>
      </div>
      {failed?<p>El video original no está disponible en este momento.</p>:
       <video src={source} controls autoPlay playsInline preload="metadata" onError={error}/>}
      <button type="button" className="realizo-v11-use" onClick={()=>{setOpen(false);onChoose(item.id)}}>
       Usar esta plantilla →
      </button>
    </div>
   </div>}
   {!featured&&<p className="realizo-v11-disclaimer">Es el anuncio original, no un video de ejemplo inventado. Muapi puede variar visualmente la nueva generación aunque conserve el prompt.</p>}
 </section>;
}
