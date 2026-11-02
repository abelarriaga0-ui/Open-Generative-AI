'use client';
import {useEffect,useRef} from 'react';
import RealizoTemplateLibrary from '@/components/RealizoTemplateLibrary';
import {TEMPLATE_HOVER_SRC,TEMPLATE_POSTER_SRC} from '@/lib/realizo-creative/template-video-input';

const access=[
 {n:'01',title:'Plantillas',meta:'Elige. Adapta. Crea.',icon:'▦',type:'template'},
 {n:'02',title:'Crear con IA',meta:'Tu producto, una idea nueva.',icon:'✳',type:'ai'},
 {n:'03',title:'Imágenes que venden',meta:'Mismo diseño, tu producto.',icon:'✦',type:'images'},
 {n:'04',title:'Modo libre',meta:'Tú decides cada detalle.',icon:'⌘',type:'manual'}
];
export default function RealizoMotionHome({onCreate,onTemplates,onUseTemplate,onAutomatic,onManual,onViewVideos,onImages}){
 const host=useRef(null);
 const video=useRef(null);
 useEffect(()=>{
  const root=host.current;
  if(!root)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(motion){root.querySelectorAll('[data-reveal]').forEach(el=>el.classList.add('is-visible'));return;}
  const observer=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting){
    entry.target.classList.add('is-visible');observer.unobserve(entry.target);
   }
  },{threshold:.12,rootMargin:'0px 0px -24px 0px'});
  root.querySelectorAll('[data-reveal]').forEach(el=>observer.observe(el));
  return ()=>observer.disconnect();
 },[]);
 useEffect(()=>{
  const el=video.current;
  if(!el)return;
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce)return;
  const observer=new IntersectionObserver(entries=>{
   if(entries[0]?.isIntersecting){el.play().catch(()=>{});}
   else el.pause();
  },{threshold:.15});
  observer.observe(el);
  return ()=>observer.disconnect();
 },[]);
 const action={template:onTemplates,ai:onCreate,manual:onManual,images:onImages};
 return <div ref={host} className="realizo-motion-home">
  <section className="realizo-motion-hero" aria-label="Bienvenido a Realizo" data-reveal>
   <div className="realizo-motion-grain" aria-hidden="true"/>
   <div className="realizo-motion-ambient" aria-hidden="true"/>
   <div className="realizo-motion-hero-copy">
    <div className="realizo-motion-live"><span className="realizo-motion-live-dot"/> REALIZO STUDIO <span className="realizo-motion-live-line"/> IA CREATIVA</div>
    <h1>De una foto<br/>a algo <em>extraordinario.</em></h1>
    <p>Crea anuncios que destacan.</p>
    <div className="realizo-motion-hero-actions">
     <button type="button" className="realizo-motion-cta" onClick={onCreate}>Crear video <span aria-hidden="true">↗</span></button>
     <button type="button" className="realizo-motion-ghost" onClick={onImages}>Crear imagen <span aria-hidden="true">→</span></button>
    </div>
    <div className="realizo-motion-hero-foot"><span className="realizo-motion-sparkle" aria-hidden="true">✳</span> De tu producto al primer plano.</div>
   </div>
   <div className="realizo-motion-stage" aria-label="Vista previa del anuncio UGC de Realizo">
    <div className="realizo-motion-stage-halo" aria-hidden="true"/>
    <div className="realizo-motion-stage-orbit orbit-one" aria-hidden="true"/>
    <div className="realizo-motion-stage-orbit orbit-two" aria-hidden="true"/>
    <div className="realizo-motion-stage-back-card back-one" aria-hidden="true"><span>30s</span></div>
    <div className="realizo-motion-stage-back-card back-two" aria-hidden="true"><span>9:16</span></div>
    <div className="realizo-motion-film">
     <video ref={video} src={TEMPLATE_HOVER_SRC} poster={TEMPLATE_POSTER_SRC}
      muted loop playsInline preload="metadata" disablePictureInPicture
      controlsList="nodownload noremoteplayback noplaybackrate"
      onContextMenu={e=>e.preventDefault()} aria-label="Avance de la plantilla UGC Vendedor"/>
     <div className="realizo-motion-film-shade"/>
     <div className="realizo-motion-film-top"><span>◉</span> VISTA PREVIA</div>
     <div className="realizo-motion-film-bottom">
      <strong>UGC Vendedor</strong>
      <span>00:30 <i/> ORIGINAL</span>
     </div>
    </div>
    <div className="realizo-motion-float-label float-top" aria-hidden="true"><span>✦</span> VIDEOS CON IA</div>
    <div className="realizo-motion-float-label float-bottom" aria-hidden="true"><span>↗</span> TU PRÓXIMA IDEA</div>
   </div>
  </section>
  <div className="realizo-motion-rail" aria-hidden="true">
   <div className="realizo-motion-ticker">
    {Array.from({length:4},(_,i)=><span key={i}>IDEAS EN MOVIMIENTO <b>✳</b> REALIZO <b>✳</b> CREA SIN LÍMITES <b>✳</b></span>)}
   </div>
  </div>
  <section className="realizo-motion-way" aria-label="Elige cómo crear" data-reveal>
   <div className="realizo-motion-section-head">
    <div><span className="realizo-motion-kicker">TU ESPACIO CREATIVO</span><h2>Tú eliges cómo crear<span>.</span></h2></div>
    <span className="realizo-motion-head-counter">01 — 04</span>
   </div>
   <div className="realizo-motion-way-grid">
    {access.map((a,i)=><button key={a.type} type="button" onClick={action[a.type]}
      className={'realizo-motion-way-card way-'+i}>
      <span className="realizo-motion-card-top"><span>{a.n} / REALIZO</span><span aria-hidden="true">↗</span></span>
      <span className="realizo-motion-way-icon" aria-hidden="true">{a.icon}</span>
      <strong>{a.title}</strong><small>{a.meta}</small>
      <span className="realizo-motion-card-line" aria-hidden="true"/>
    </button>)}
   </div>
  </section>
  <section className="realizo-motion-image-spotlight" aria-label="Imágenes que venden" data-reveal>
   <div className="realizo-motion-image-copy">
     <span className="realizo-motion-kicker">NUEVO EN REALIZO · IMÁGENES</span>
     <h2>Tu producto.<br/><em>El mismo impacto.</em></h2>
     <p>Elige una plantilla publicitaria, sube tu producto y conserva el diseño que te gustó.</p>
     <button type="button" className="realizo-motion-cta" onClick={onImages}>Explorar imágenes <span aria-hidden="true">↗</span></button>
     <div className="realizo-motion-image-meta"><span>Plantillas premium</span><span>4K</span><span>Sin prompts</span></div>
   </div>
   <button type="button" className="realizo-motion-image-art" onClick={onImages} aria-label="Explorar plantilla Explosión Premium Azul">
     <img src="/templates/explosion-premium-azul.webp" alt="Plantilla publicitaria Explosión Premium Azul" loading="lazy"/>
     <span>EXPLORAR DISEÑO <b aria-hidden="true">↗</b></span>
   </button>
  </section>
  <section className="realizo-motion-spotlight" aria-label="Plantilla disponible" data-reveal>
   <div className="realizo-motion-section-head">
    <div><span className="realizo-motion-kicker">EXPLORA</span><h2>Hecho para destacar<span>.</span></h2></div>
    <button type="button" className="realizo-motion-all" onClick={onTemplates}>Plantillas <span aria-hidden="true">↗</span></button>
   </div>
   <div className="realizo-motion-featured">
    <div className="realizo-motion-featured-copy">
     <span className="realizo-motion-featured-eyebrow"><span/> PLANTILLA REAL</span>
     <h3>Un anuncio.<br/><em>Tu producto.</em></h3>
     <p>UGC Vendedor · 30 segundos</p>
     <button type="button" onClick={()=>onUseTemplate('ugc-vendedor')}>
      Usar plantilla <span aria-hidden="true">↗</span>
     </button>
     <div className="realizo-motion-mini-specs"><span>30s</span><span>9:16</span><span>ES</span></div>
    </div>
    <div className="realizo-motion-featured-video">
      <RealizoTemplateLibrary featured onChoose={onUseTemplate}/>
    </div>
   </div>
  </section>
  <section className="realizo-motion-footer-action" data-reveal>
   <div><span className="realizo-motion-kicker">EMPIEZA AQUÍ</span><h2>La siguiente idea es tuya<span>.</span></h2></div>
   <div><button type="button" className="realizo-motion-cta" onClick={onCreate}>Crear video <span aria-hidden="true">↗</span></button>
   <button type="button" className="realizo-motion-footer-link" onClick={onViewVideos}>Mis videos →</button></div>
  </section>
 </div>;
}
