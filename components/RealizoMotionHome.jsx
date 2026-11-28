'use client';

import {useEffect,useRef,useState,useId} from 'react';
import RealizoSwipeRail from '@/components/RealizoSwipeRail';
import {TEMPLATE_HOVER_SRC,TEMPLATE_POSTER_SRC} from '@/lib/realizo-creative/template-video-input';

const products=[
 {name:'Esencia',type:'PERFUME / CONCEPTO',tone:'#d0b49b',dark:'#503322',light:'#ffe6bd',scene:'#72523f',shape:'perfume'},
 {name:'Ritual',type:'CUIDADO PERSONAL / CONCEPTO',tone:'#b0c9b8',dark:'#274b42',light:'#dcf4dc',scene:'#345b50',shape:'bottle'},
 {name:'Energía',type:'BEBIDA / CONCEPTO',tone:'#b8cce6',dark:'#263b6b',light:'#e3efff',scene:'#32486d',shape:'can'},
];
const options=[
 {number:'01',title:'Crear video con IA',description:'De una foto a tu anuncio.',kind:'ai',image:TEMPLATE_POSTER_SRC,tag:'VIDEO'},
 {number:'02',title:'Crear imágenes',description:'Diseños que hacen destacar tu producto.',kind:'images',image:'/templates/explosion-premium-azul.webp',tag:'IMAGEN'},
 {number:'03',title:'Explorar plantillas',description:'Empieza con una idea.',kind:'template',image:'/assets/realizo/templates/demo-photos.webp',tag:'PLANTILLAS'},
 {number:'04',title:'Prompt libre',description:'Tu visión, tus reglas.',kind:'manual',image:'/assets/cinema/creative_tilt_lens.webp',tag:'CONTROL CREATIVO'},
 {number:'05',title:'Hiperrealista PRO',description:'Dirección cinematográfica.',kind:'hyperreal',image:'/assets/cinema/premium_large_format_digital.webp',tag:'PRODUCCIÓN'},
];

function ProductArtwork({product:p}){
 const id=useId().replace(/:/g,'');
 const glass=id+'glass',cap=id+'cap',shine=id+'shine',base=id+'base';
 const body=p.shape==='perfume'?'M106 135 Q106 116 128 111 L272 111 Q294 116 294 135 L310 346 Q310 368 286 373 L114 373 Q90 368 90 346 Z':p.shape==='bottle'?'M150 100 L250 100 Q250 117 274 139 Q292 157 292 186 L292 345 Q292 373 270 377 L130 377 Q108 373 108 345 L108 186 Q108 157 126 139 Q150 117 150 100 Z':'M128 91 Q115 101 115 126 L115 353 Q115 376 141 380 L259 380 Q285 376 285 353 L285 126 Q285 101 272 91 Z';
 return <svg viewBox="0 0 400 430" aria-hidden="true" focusable="false" className="rzx-product-svg">
  <defs>
   <linearGradient id={glass}><stop stopColor={p.dark}/><stop offset=".09" stopColor={p.light}/><stop offset=".19" stopColor={p.tone}/><stop offset=".49" stopColor={p.dark}/><stop offset=".76" stopColor={p.tone}/><stop offset=".94" stopColor={p.dark}/><stop offset="1" stopColor={p.light}/></linearGradient>
   <linearGradient id={cap}><stop stopColor="#080a0a"/><stop offset=".18" stopColor="#444647"/><stop offset=".47" stopColor="#101111"/><stop offset=".83" stopColor="#373839"/><stop offset="1" stopColor="#101111"/></linearGradient>
   <linearGradient id={shine} x1="0" x2="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".32"/><stop offset=".3" stopColor="#ffffff" stopOpacity="0"/><stop offset=".86" stopColor="#080808" stopOpacity="0"/><stop offset="1" stopColor="#080808" stopOpacity=".65"/></linearGradient>
   <radialGradient id={base}><stop stopColor="#000" stopOpacity=".85"/><stop offset="1" stopColor="#000" stopOpacity="0"/></radialGradient>
  </defs>
  <ellipse cx="200" cy="397" rx="156" ry="20" fill={'url(#'+base+')'}/>
  {p.shape==='perfume'?<><rect x="144" y="46" width="112" height="74" rx="5" fill={'url(#'+cap+')'}/><path d="M151 48h98M151 113h98" stroke="#9d9d99" opacity=".5"/><rect x="161" y="108" width="78" height="18" fill={p.dark}/></>:p.shape==='bottle'?<><rect x="173" y="62" width="54" height="42" rx="4" fill={'url(#'+cap+')'}/><path d="M190 66V42Q190 30 203 30H262V43H218V66Z" fill={'url(#'+cap+')'}/></>:<ellipse cx="200" cy="95" rx="73" ry="14" fill="#bfc6c9"/>}
  <path d={body} fill={'url(#'+glass+')'} stroke={p.light} strokeOpacity=".52" strokeWidth="1.5"/>
  <path d={body} fill={'url(#'+shine+')'}/>
  <path d={p.shape==='perfume'?'M118 135L107 340Q107 354 124 359':'M135 153V346Q135 357 145 360'} fill="none" stroke="#fff" strokeWidth="4" opacity=".32" strokeLinecap="round"/>
  <rect x="133" y="210" width="134" height="94" rx="2" fill="#e7e1d1" opacity=".95"/>
  <text x="200" y="235" textAnchor="middle" fontSize="9" letterSpacing="3" fill="#353634">REALIZO / LAB</text>
  <text x="200" y="264" textAnchor="middle" fontSize="24" fontFamily="Georgia,serif" fill="#1b2221">{p.name}</text>
  <path d="M176 277H224" stroke="#5d615b" strokeWidth=".6"/>
  <text x="200" y="291" textAnchor="middle" fontSize="6.5" letterSpacing="2" fill="#414544">CONCEPTO VISUAL</text>
  {p.shape==='can'&&<><ellipse cx="200" cy="96" rx="73" ry="9" fill="#dce2e5" stroke="#78828b"/><ellipse cx="200" cy="95" rx="17" ry="4" fill="#75808a"/></>}
 </svg>;
}

export default function RealizoMotionHome({onCreate,onTemplates,onManual,onViewVideos,onImages,onHyperreal}){
 const [selected,setSelected]=useState(0);
 const [isPlaying,setIsPlaying]=useState(false);
 const videoRef=useRef(null),visualRef=useRef(null),heroRef=useRef(null),drag=useRef(null),frame=useRef(0),pending=useRef([0,0]);
 const playbackPreference=useRef('auto');
 const product=products[selected];
 function turn(x,y){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  pending.current=[Math.max(-24,Math.min(24,x)),Math.max(-13,Math.min(13,y))];
  if(frame.current)return;
  frame.current=requestAnimationFrame(()=>{frame.current=0;const el=visualRef.current;if(!el)return;el.style.setProperty('--rzx-ry',pending.current[0]+'deg');el.style.setProperty('--rzx-rx',pending.current[1]+'deg');});
 }
 function changeProduct(index){setSelected((index+products.length)%products.length);turn(0,0);}
 function pointerDown(e){
  if(e.button!==0)return;
  drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};
  e.currentTarget.setPointerCapture(e.pointerId);
 }
 function pointerMove(e){
  const d=drag.current;
  if(d?.id===e.pointerId){turn((e.clientX-d.x)*.14,-(e.clientY-d.y)*.12);return;}
  if(e.pointerType==='mouse'){const b=e.currentTarget.getBoundingClientRect();turn((e.clientX-b.left-b.width/2)/b.width*30,-(e.clientY-b.top-b.height/2)/b.height*18);}
 }
 function pointerEnd(e){if(drag.current?.id===e.pointerId)drag.current=null;turn(0,0);}
 useEffect(()=>()=>{if(frame.current)cancelAnimationFrame(frame.current);},[]);
 useEffect(()=>{
  const hero=heroRef.current;if(!hero)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');let request=0;
  const update=()=>{request=0;if(motion.matches){hero.style.removeProperty('--rzx-scroll-shift');return;}const rect=hero.getBoundingClientRect();const progress=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height)));hero.style.setProperty('--rzx-scroll-shift',(progress*45).toFixed(2)+'px');};
  const queue=()=>{if(!request)request=requestAnimationFrame(update);};
  window.addEventListener('scroll',queue,{passive:true});motion.addEventListener?.('change',queue);queue();
  return()=>{window.removeEventListener('scroll',queue);motion.removeEventListener?.('change',queue);if(request)cancelAnimationFrame(request);};
 },[]);
 useEffect(()=>{
  const node=videoRef.current;if(!node)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');let visible=false;
  const sync=()=>{if(visible&&!document.hidden&&playbackPreference.current!=='paused'&&(!motion.matches||playbackPreference.current==='playing'))node.play().catch(()=>{});else node.pause();};
  const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{visible=Boolean(entries[0]?.isIntersecting&&entries[0]?.intersectionRatio>=.25);sync();},{threshold:.25}):null;
  observer?.observe(node);document.addEventListener('visibilitychange',sync);motion.addEventListener?.('change',sync);
  return()=>{observer?.disconnect();document.removeEventListener('visibilitychange',sync);motion.removeEventListener?.('change',sync);node.pause();};
 },[]);
 function togglePreview(){const node=videoRef.current;if(!node)return;if(node.paused){playbackPreference.current='playing';node.play().catch(()=>{});}else{playbackPreference.current='paused';node.pause();}}
 const actions={ai:onCreate,images:onImages,template:onTemplates,manual:onManual,hyperreal:onHyperreal};
 return <div className="ra-immersive-home">
  <section ref={heroRef} className="rzx-hero" style={{'--rzx-tone':product.tone,'--rzx-scene':product.scene}} aria-label="Realizo, estudio creativo con IA">
   <div className="rzx-atmosphere" aria-hidden="true"/>
   <div className="rzx-topline"><span>ESTUDIO CREATIVO / IA</span><span>DISEÑADO PARA CREAR</span></div>
   <p className="rzx-intro">Una nueva manera<br/>de contar historias.</p>
   <h1 className="rzx-title">REALIZO<span className="rzx-sr"> — Estudio creativo con IA</span></h1>
   <div className="rzx-product-zone" role="group" aria-label="Vista interactiva de producto de ejemplo">
    <div className="rzx-product-touch" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={pointerEnd} onLostPointerCapture={pointerEnd} onPointerLeave={()=>{if(!drag.current)turn(0,0);}}>
     <div ref={visualRef} className="rzx-product-motion"><div key={product.name} className="rzx-product-arrival"><ProductArtwork product={product}/></div></div>
    </div>
    <div className="rzx-product-controls">
     <button type="button" onClick={()=>changeProduct(selected-1)} aria-label="Producto anterior">←</button>
     <div aria-live="polite"><strong>{product.name}</strong><small>{product.type}</small></div>
     <button type="button" onClick={()=>changeProduct(selected+1)} aria-label="Producto siguiente">→</button>
    </div>
   </div>
   <div className="rzx-meta"><span>{String(selected+1).padStart(2,'0')} / 03 — CONCEPTOS</span><div className="rzx-swatches" aria-label="Elegir producto">{products.map((p,i)=><button key={p.name} type="button" style={{'--swatch':p.tone}} aria-label={p.name} aria-pressed={selected===i} onClick={()=>changeProduct(i)}/>)}</div><small>Arrastra o mueve el cursor.</small></div>
   <div className="rzx-copy"><p className="rzx-script">sin límites.</p><p>Tu producto. Una foto. Un universo de posibilidades.</p><div className="rzx-actions"><button type="button" className="rzx-primary" onClick={onCreate}>Crear video <span>↗</span></button><button type="button" className="rzx-secondary" onClick={onTemplates}>Ver plantillas</button></div><small>Conoce el precio antes de generar.</small></div>
   <a className="rzx-scroll" href="#rzx-tools">Explorar el estudio <span aria-hidden="true">↓</span></a>
  </section>
  <section className="rzx-section" id="rzx-tools" aria-labelledby="rzx-tools-title" data-ra-reveal>
   <div className="rzx-section-head"><div><p>01 / TU ESTUDIO</p><h2 id="rzx-tools-title">Todo lo que imaginas.</h2></div><span>Elige tu siguiente creación.</span></div>
   <RealizoSwipeRail className="rzx-rail" label="Formas de crear en Realizo">
    {options.map(o=><button type="button" key={o.kind} className="rzx-tool" onClick={actions[o.kind]}><img src={o.image} alt="" loading="lazy"/><span className="rzx-tool-gradient"/><span className="rzx-tool-tag">{o.number} / {o.tag}</span><span className="rzx-tool-copy"><strong>{o.title}</strong><small>{o.description}</small></span><span className="rzx-tool-arrow" aria-hidden="true">↗</span></button>)}
   </RealizoSwipeRail>
  </section>
  <section className="rzx-section rzx-showcase" aria-label="Ejemplo de video publicitario" data-ra-reveal>
   <div className="rzx-showcase-copy"><p>02 / DE LA IDEA A LA PANTALLA</p><h2>Que tu producto<br/><em>cuente una historia.</em></h2><p>Explora un ejemplo real de video publicitario UGC y comienza con una plantilla.</p><button className="rzx-primary" type="button" onClick={onTemplates}>Explorar videos <span>↗</span></button></div>
   <div className="rzx-showcase-media"><video ref={videoRef} src={TEMPLATE_HOVER_SRC} poster={TEMPLATE_POSTER_SRC} muted loop playsInline preload="metadata" disablePictureInPicture controlsList="nodownload noremoteplayback noplaybackrate" aria-label="Ejemplo de anuncio UGC" onPlay={()=>setIsPlaying(true)} onPause={()=>setIsPlaying(false)} onEnded={()=>setIsPlaying(false)}/><button className="rzx-play" type="button" onClick={togglePreview} aria-label={isPlaying?'Pausar video':'Reproducir video'}>{isPlaying?'Ⅱ':'▶'}</button></div>
  </section>
  <section className="rzx-section rzx-end" aria-label="Comienza a crear"><h2>Imagina. Crea. Publica.</h2><div className="rzx-actions"><button type="button" className="rzx-primary" onClick={onCreate}>Empezar a crear ↗</button><button type="button" className="rzx-secondary" onClick={onViewVideos}>Mis creaciones</button></div></section>
 </div>;
}
