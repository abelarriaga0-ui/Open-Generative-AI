'use client';
import {useState} from 'react';
import {AD_TEMPLATES} from '@/lib/realizo-creative/ad-templates';

const filters=['Todos','UGC','Premium','Demo','Cine','Ofertas'];
export default function RealizoTemplateLibrary({onChoose,featured=false}){
 const [filter,setFilter]=useState('Todos');
 const templates=featured?AD_TEMPLATES.slice(0,6):AD_TEMPLATES;
 const items=filter==='Todos'?templates:templates.filter(item=>item.group===filter);
 return <section className={'realizo-v11-library'+(featured?' realizo-v11-featured':'')} aria-label="Plantillas publicitarias reales">
  {!featured&&<div className="realizo-v11-lib-head">
   <div><span className="realizo-v11-eyebrow">BIBLIOTECA CREATIVA</span><h2>Tu anuncio, <em>tu estilo.</em></h2>
    <p>Selecciona una estructura real: guion, tomas, ritmo y transiciones quedarán precargados.</p></div>
   <span className="realizo-v11-count">{AD_TEMPLATES.length} plantillas</span>
  </div>}
  {!featured&&<div className="realizo-v11-filters" aria-label="Filtrar plantillas">
   {filters.map(value=><button type="button" key={value} aria-pressed={filter===value}
    onClick={()=>setFilter(value)}>{value}</button>)}
  </div>}
  <div className="realizo-v11-cards">
   {items.map((item,i)=><article className="realizo-v11-card" key={item.id}>
    <button type="button" className="realizo-v11-image-link"
     onClick={()=>onChoose(item.id)} aria-label={'Usar plantilla '+item.name}>
     <div className={'realizo-v11-card-photo realizo-v11-photo-'+item.visual} aria-hidden="true"/>
     <div className="realizo-v11-photo-fade"/>
     <span className="realizo-v11-duration">0:{String(item.duration).padStart(2,'0')}</span>
     <span className="realizo-v11-play" aria-hidden="true">▶</span>
     <div className="realizo-v11-card-overlay">
      <h3>{item.name}</h3><p>{item.short}</p>
      <span className="realizo-v11-tag">{item.icon} {item.tag}</span>
     </div>
    </button>
    {!featured&&<div className="realizo-v11-card-extra">
     <span>{item.group} · {item.duration} s sugeridos</span>
     <p>{item.description}</p>
    </div>}
    <button type="button" className="realizo-v11-use" onClick={()=>onChoose(item.id)}>
      Usar plantilla <span aria-hidden="true">→</span>
    </button>
   </article>)}
  </div>
  {!featured&&<p className="realizo-v11-disclaimer">Las fotos son vistas de estilo. Cada plantilla sí aplica su propia estructura narrativa, cámara y montaje al prompt; un modelo generativo no garantiza movimientos idénticos a una grabación de referencia.</p>}
 </section>;
}
