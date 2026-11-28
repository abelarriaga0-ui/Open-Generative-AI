'use client';

import {useEffect, useRef, useState} from 'react';
import RealizoSwipeRail from '@/components/RealizoSwipeRail';
import {TEMPLATE_HOVER_SRC,TEMPLATE_POSTER_SRC} from '@/lib/realizo-creative/template-video-input';

const options = [
  {number:'01',tag:'LA FORMA MÁS FÁCIL',title:'Crear video con IA',description:'Sube tu producto. Realizo te guía desde la idea hasta el video.',symbol:'✳',kind:'ai',wide:true},
  {number:'02',tag:'DISEÑO PUBLICITARIO',title:'Crear imágenes',description:'Elige un diseño y adáptalo a tu producto.',symbol:'▧',kind:'images',wide:false},
  {number:'03',tag:'EMPIEZA CON UNA IDEA',title:'Explorar plantillas',description:'Parte de un formato y hazlo tuyo.',symbol:'▤',kind:'template',wide:false},
  {number:'04',tag:'CONTROL CREATIVO',title:'Prompt libre',description:'Describe la escena y ajusta los parámetros a tu gusto.',symbol:'⌘',kind:'manual',wide:true},
  {number:'05',tag:'PRODUCCIÓN CINEMATOGRÁFICA',title:'Hiperrealista PRO',description:'Crea una campaña de varias escenas con actores, imágenes y montaje.',symbol:'✦',kind:'hyperreal',wide:false},
];

export default function RealizoMotionHome({onCreate,onTemplates,onUseTemplate,onManual,onViewVideos,onImages,onHyperreal}) {
  const videoRef=useRef(null);
  const playbackPreference=useRef('auto');
  const [isPlaying,setIsPlaying]=useState(false);
  useEffect(()=>{
    const node=videoRef.current;
    if(!node)return;
    const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView=false;
    const sync=()=>{
      const preference=playbackPreference.current;
      const canPlay=inView&&!document.hidden&&preference!=='paused'&&(!motion.matches||preference==='playing');
      if(canPlay)node.play().catch(()=>{});
      else node.pause();
    };
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{
      inView=Boolean(entries[0]?.isIntersecting&&entries[0]?.intersectionRatio>=.25);
      sync();
    },{threshold:.25}):null;
    observer?.observe(node);
    document.addEventListener('visibilitychange',sync);
    motion.addEventListener?.('change',sync);
    return ()=>{
      observer?.disconnect();
      document.removeEventListener('visibilitychange',sync);
      motion.removeEventListener?.('change',sync);
      node.pause();
    };
  },[]);
  function togglePreview(){
    const node=videoRef.current;
    if(!node)return;
    if(node.paused){
      playbackPreference.current='playing';
      node.play().catch(()=>{});
    }else{
      playbackPreference.current='paused';
      node.pause();
    }
  }
  const actions={ai:onCreate,images:onImages,template:onTemplates,manual:onManual,hyperreal:onHyperreal};
  return <div className="realizo-apple-home">
    <section className="ra-hero" aria-label="Bienvenido a Realizo">
      <div className="ra-hero-copy">
        <p className="ra-eyebrow"><span className="ra-live-dot" aria-hidden="true"/> REALIZO STUDIO</p>
        <h1><span className="ra-headline-line">Imagina.</span>{' '}<span className="ra-headline-line">Crea.</span>{' '}<span className="ra-headline-line ra-headline-accent">Hazlo realidad.</span></h1>
        <p className="ra-hero-description">Tu próximo gran anuncio empieza aquí. Transforma una foto en videos e imágenes con IA.</p>
        <div className="ra-hero-actions">
          <button type="button" className="ra-button ra-button-primary" onClick={onCreate}>Crear video <span aria-hidden="true">↗</span></button>
          <button type="button" className="ra-button ra-button-secondary" onClick={onTemplates}>Ver plantillas <span aria-hidden="true">→</span></button>
        </div>
        <div className="ra-hero-assurance">
          <span><i aria-hidden="true">✓</i> Sin editar código</span>
          <span><i aria-hidden="true">✓</i> Precio antes de generar</span>
        </div>
      </div>
      <div className="ra-showcase" aria-label="Ejemplo visual de video publicitario">
        <div className="ra-showcase-top"><span><i/> EJEMPLO DE VIDEO</span><span>FORMATO VERTICAL</span></div>
        <div className="ra-preview">
          <video ref={videoRef} src={TEMPLATE_HOVER_SRC} poster={TEMPLATE_POSTER_SRC} muted loop playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noremoteplayback noplaybackrate" aria-label="Ejemplo visual de anuncio UGC" onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} onEnded={()=>setIsPlaying(false)}/>
          <span className="ra-preview-float">CREADO PARA DESTACAR</span>
          <button type="button" className="ra-preview-toggle" onClick={togglePreview} aria-label={isPlaying?'Pausar video de ejemplo':'Reproducir video de ejemplo'} title={isPlaying?'Pausar video':'Reproducir video'}>
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{isPlaying?<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>:<path d="M8 5v14l11-7z"/>}</svg>
          </button>
        </div>
        <div className="ra-showcase-bottom"><div><strong>UGC Vendedor</strong><span>Una idea de lo que puedes crear</span></div><button type="button" onClick={onTemplates} aria-label="Explorar plantillas">↗</button></div>
      </div>
    </section>

    <section data-ra-reveal className="ra-tool-section" aria-labelledby="ra-tools-title">
      <div className="ra-section-title"><div><p className="ra-eyebrow">TU ESTUDIO, TUS REGLAS</p><h2 id="ra-tools-title">Todo empieza aquí.</h2></div><p>Elige cómo quieres crear.</p></div>
      <RealizoSwipeRail className="ra-tools ra-swipe-home" label="Desliza entre las formas de crear">
        {options.map(option=><button type="button" key={option.kind} className={'ra-tool-card'+(option.wide?' ra-tool-wide':'')} onClick={actions[option.kind]}>
          <span className="ra-tool-top"><span>{option.number} / {option.tag}</span><span aria-hidden="true">↗</span></span>
          <span className="ra-tool-icon" aria-hidden="true">{option.symbol}</span>
          <span className="ra-tool-bottom"><strong>{option.title}</strong><small>{option.description}</small></span>
        </button>)}
      </RealizoSwipeRail>
    </section>

    <section data-ra-reveal className="ra-spotlight" aria-label="Imágenes publicitarias">
      <div className="ra-spotlight-copy">
        <p className="ra-eyebrow">IMÁGENES QUE VENDEN</p>
        <h2>Tu marca, en<br/><span>primer plano.</span></h2>
        <p>Elige una composición, sube tu fotografía y crea una pieza publicitaria sin partir de cero.</p>
        <button type="button" className="ra-button ra-button-light" onClick={onImages}>Explorar diseños <span aria-hidden="true">↗</span></button>
      </div>
      <button type="button" className="ra-spotlight-art" onClick={onImages} aria-label="Explorar diseños de imágenes">
        <img src="/templates/explosion-premium-azul.webp" alt="Ejemplo de diseño publicitario Explosión Premium Azul" loading="lazy"/>
        <span>VER DISEÑOS <b aria-hidden="true">↗</b></span>
      </button>
    </section>

    <section data-ra-reveal className="ra-closing" aria-label="Comienza a crear">
      <div><p className="ra-eyebrow">EL SIGUIENTE PASO</p><h2>Imagina. Crea. Publica.</h2><p>Elige tu formato. Nosotros te acompañamos en el proceso.</p></div>
      <div className="ra-closing-actions"><button className="ra-button ra-button-primary" type="button" onClick={onCreate}>Empezar a crear <span aria-hidden="true">↗</span></button><button className="ra-text-link" type="button" onClick={onViewVideos}>Ver mis creaciones →</button></div>
    </section>
  </div>;
}
