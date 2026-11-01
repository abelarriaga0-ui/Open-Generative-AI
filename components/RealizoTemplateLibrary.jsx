'use client';
import {useState} from 'react';

const looks=[
 {id:'ugc-real',style:'ugc',filter:'UGC',name:'Recomendación natural',description:'Creador a cámara, voz protagonista y producto en uso.',tone:'people',duration:'15 s',headline:'La rutina que sí encaja',tag:'UGC / PERSONA'},
 {id:'cine-story',style:'cinematic',filter:'Cine',name:'Historia que conecta',description:'Un problema cotidiano contado con lenguaje de cine.',tone:'story',duration:'15 s',headline:'El instante cambia',tag:'CINE / EMOCIÓN'},
 {id:'premium-hero',style:'premium',filter:'Premium',name:'Detalle de producto',description:'Texturas, luz, transiciones y valor percibido.',tone:'lux',duration:'12 s',headline:'Cada detalle cuenta',tag:'PREMIUM / PRODUCTO'},
 {id:'demo-proof',style:'demo',filter:'Demo',name:'Producto en acción',description:'Uso paso a paso con demostración clara.',tone:'demo',duration:'15 s',headline:'Míralo funcionar',tag:'DEMO / USO'},
 {id:'ugc-problem',style:'ugc',filter:'UGC',name:'Problema y solución',description:'Identificación inmediata y explicación conversada.',tone:'people-alt',duration:'20 s',headline:'¿Te ha pasado?',tag:'UGC / PROBLEMA'},
 {id:'cinematic-night',style:'cinematic',filter:'Cine',name:'Campaña sensorial',description:'Ritmo, movimiento, atmósfera y cierre comercial.',tone:'night',duration:'20 s',headline:'Hazlo inolvidable',tag:'CINE / ATMÓSFERA'},
 {id:'premium-clean',style:'premium',filter:'Premium',name:'Minimalista editorial',description:'Composición limpia y producto como protagonista.',tone:'clean',duration:'12 s',headline:'Menos es más',tag:'PREMIUM / EDITORIAL'},
 {id:'demo-explainer',style:'demo',filter:'Demo',name:'Tres beneficios',description:'Muestra varias ventajas con cortes explicativos.',tone:'explainer',duration:'20 s',headline:'Tres razones',tag:'DEMO / BENEFICIOS'},
];

function Preview({look}){
 return <div className={'realizo-template-preview realzo-t-'+look.tone} aria-hidden="true">
  <div className="realizo-template-light"/>
  <div className="realizo-template-human"><span className="realizo-template-face"/><span className="realizo-template-shirt"/></div>
  <div className="realizo-template-prop"><span/></div>
  <div className="realizo-template-filmgrain"/>
  <div className="realizo-template-poster">
   <span>{look.tag}</span>
   <strong>{look.headline}</strong>
  </div>
  <div className="realizo-template-time">{look.duration}</div>
 </div>;
}
export default function RealizoTemplateLibrary({onChoose}){
 const [filter,setFilter]=useState('Todos');
 const filtered=filter==='Todos'?looks:looks.filter(x=>x.filter===filter);
 return <section className="realizo-library" aria-label="Biblioteca visual de estilos publicitarios">
  <div className="realizo-library-top">
   <div>
    <p className="realizo-kicker">BIBLIOTECA CREATIVA</p>
    <h2>Inspírate. Personaliza. <em>Crea.</em></h2>
    <p>Explora estilos y arranca con la dirección visual adecuada para tu producto.</p>
   </div>
   <span className="realizo-library-count">{looks.length} estilos visuales</span>
  </div>
  <div className="realizo-library-filters" aria-label="Filtrar formatos">
   {['Todos','UGC','Cine','Premium','Demo'].map(f=><button
    key={f} type="button" aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f}</button>)}
  </div>
  <div className="realizo-template-grid">
   {filtered.map(look=><article className="realizo-template-card" key={look.id}>
    <Preview look={look}/>
    <div className="realizo-template-info">
     <div className="realizo-template-meta"><span>{look.filter}</span><span>{look.duration}</span></div>
     <h3>{look.name}</h3>
     <p>{look.description}</p>
     <button type="button" onClick={()=>onChoose(look.style)}
      aria-label={'Crear video con estilo '+look.name}>
      Crear en este estilo <span aria-hidden="true">↗</span>
     </button>
    </div>
   </article>)}
  </div>
  <p className="realizo-library-disclaimer">Vistas ilustrativas del estilo, no videos generados ni plantillas de movimientos exactos. La escena final se prepara con tu producto y el modelo que elijas.</p>
 </section>;
}
