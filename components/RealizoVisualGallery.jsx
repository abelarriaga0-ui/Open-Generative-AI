'use client';
import React from 'react';

const items=[
 {id:'ugc',kicker:'01 · Auténtico',title:'UGC que conecta',
  detail:'Un creador real. Una historia convincente.',duration:'15 s',
  tone:'ugc',icon:'●'},
 {id:'cinematic',kicker:'02 · Storytelling',title:'Cine que vende',
  detail:'Emoción, ritmo, luz y transiciones.',duration:'15 s',
  tone:'cinema',icon:'✦'},
 {id:'premium',kicker:'03 · Producto',title:'Premium visual',
  detail:'Detalles que elevan el valor percibido.',duration:'15 s',
  tone:'luxury',icon:'◆'},
 {id:'demo',kicker:'04 · Acción',title:'Demostración',
  detail:'Muestra cómo se usa, cuenta por qué importa.',duration:'15 s',
  tone:'demo',icon:'▶'},
];
// Decorative mockups are format illustrations, now using original generated
// photographic examples rather than CSS-drawn people/products. They are NOT
// playable video samples or exact-motion templates.
function Scene({tone}){
 return <div className={'realizo-format-scene realizo-photo-format realizo-photo-format--'+tone} aria-hidden="true">
  <div className="realizo-photo-format-image"/>
  <div className="realizo-photo-format-shade"/>
  <div className="realizo-scene-play"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="m8 5 12 7-12 7z"/></svg></div>
 </div>;
}
export default function RealizoVisualGallery({onChoose,compact=false}){
 return <section className={'realizo-format-section'+(compact?' realizo-format-section--compact':'')} aria-label="Estilos de video publicitario">
  <div className="realizo-section-heading">
   <div><p className="realizo-kicker">DIRECCIÓN CREATIVA</p>
    <h2>Encuentra el estilo de tu próximo anuncio<span>.</span></h2>
    <p className="realizo-muted">Elige un formato. REALIZO mantiene el motor, los precios y tu proceso habitual.</p></div>
   <span className="realizo-section-aside">4 formatos · mismo flujo de creación</span>
  </div>
  <div className="realizo-format-grid">
   {items.map(item=><button type="button" key={item.id} className="realizo-format-card"
      onClick={()=>onChoose(item.id)} aria-label={'Crear anuncio '+item.title}>
    <Scene tone={item.tone}/>
    <div className="realizo-format-meta">
     <div className="realizo-format-kicker"><span>{item.kicker}</span><span>{item.duration}</span></div>
     <h3>{item.title}</h3>
     <p>{item.detail}</p>
     <span className="realizo-format-action">Crear en este estilo <span aria-hidden="true">↗</span></span>
    </div>
   </button>)}
  </div>
 </section>;
}
