'use client';
import {useEffect,useRef,useState} from 'react';

const TYPES=[
 {id:'premium',label:'Premium',detail:'Fotografía elegante'},
 {id:'oferta',label:'Oferta',detail:'Venta directa'},
 {id:'beneficios',label:'Beneficios',detail:'Lo que aporta'},
 {id:'problema',label:'Problema / solución',detail:'Necesidad visible'},
 {id:'ugc',label:'UGC',detail:'Estilo auténtico'},
 {id:'minimalista',label:'Minimalista',detail:'Producto protagonista'}
];
const STYLES=[
 {id:'elegante',label:'Elegante'}, {id:'venta',label:'Comercial'},
 {id:'natural',label:'Natural'}, {id:'confianza',label:'Confianza'},
 {id:'tecnologico',label:'Tecnológico'}
];
const FORMATS=['1:1','4:5','9:16','16:9'];
const GOALS=[
 {id:'compras',label:'Más compras'},
 {id:'clics',label:'Más clics'},
 {id:'confianza',label:'Más confianza'},
 {id:'urgencia',label:'Acción inmediata'}
];
const DEFAULT={
 creative_type:'premium',style:'elegante',goal:'compras',aspect_ratio:'4:5',
 show_price:false,price:'',product_name:'',product_benefit:'',extra_instruction:''
};
const money=n=>Number.isInteger(n)?new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(n/100):'—';
const outputURL=job=>{
 const v=job?.result||{};
 const items=v.outputs??v.output??v.url;
 if(typeof items==='string')return items;
 if(Array.isArray(items)&&items.length)return typeof items[0]==='string'?items[0]:items[0]?.url||null;
 return items?.url||null;
};
function Choice({value,options,onChange,className=''}) {
 return <div className={'ri-choice '+className} role="group">
   {options.map(o=>{
     const item=typeof o==='string'?{id:o,label:o}:o;
     return <button type="button" key={item.id} className={value===item.id?'is-selected':''}
       aria-pressed={value===item.id} onClick={()=>onChange(item.id)}>{item.label}</button>;
   })}
 </div>;
}
export default function ConversionTemplatesStudio({guest=false,onGenerationStart,onGenerationEnd,onGenerationComplete,onGenerationError}){
 const [mode,setMode]=useState('create');
 const [form,setForm]=useState(DEFAULT);
 const [file,setFile]=useState(null);
 const [preview,setPreview]=useState(null);
 const [runtime,setRuntime]=useState(null);
 const [presets,setPresets]=useState([]);
 const [history,setHistory]=useState([]);
 const [presetTitle,setPresetTitle]=useState('');
 const [busy,setBusy]=useState(false);
 const [phase,setPhase]=useState('');
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [resultUrl,setResultUrl]=useState('');
 const [currentJob,setCurrentJob]=useState('');
 const inputRef=useRef(null);
 const change=(key,value)=>{setForm(current=>({...current,[key]:value}));setError('');setNotice('');};
 const imagePrice=runtime?.image_price_cents??null;
 const researchPrice=runtime?.research_price_cents??null;
 const total=Number.isInteger(imagePrice)&&Number.isInteger(researchPrice)?imagePrice+researchPrice:null;
 const ready=Boolean(runtime?.available);
 const mustPrice=form.show_price&&!form.price.trim();
 const currentType=TYPES.find(t=>t.id===form.creative_type)||TYPES[0];
 const aspect=form.aspect_ratio.replace(':',' / ');
 const titleText=form.product_name.trim()||'Tu producto aquí';

 useEffect(()=>{
  let active=true;
  fetch('/api/realizo/images/config',{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(Error('No se pudo consultar el motor de imágenes.')))
   .then(data=>{if(active)setRuntime(data);}).catch(e=>{if(active)setError(e.message);});
  return ()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!file){setPreview(null);return;}
  const url=URL.createObjectURL(file);
  setPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[file]);
 useEffect(()=>{
  if(guest)return;
  if(mode==='presets')loadPresets();
  if(mode==='history')loadHistory();
 },[mode,guest]);
 async function loadPresets(){
  try{const r=await fetch('/api/realizo/images/presets',{cache:'no-store'});if(r.ok)setPresets((await r.json()).presets||[]);}
  catch{setError('No se pudieron consultar tus plantillas.');}
 }
 async function loadHistory(){
  try{
   const r=await fetch('/api/realizo/images/history',{cache:'no-store'});
   if(!r.ok)throw Error('history_unavailable');
   const all=(await r.json()).creations||[];
   setHistory(all);
   const pending=all.filter(item=>item.status==='submitted'&&item.job_id).slice(0,8);
   if(pending.length){
    await Promise.allSettled(pending.map(async item=>{
     const status=await fetch('/api/wallet/jobs/'+encodeURIComponent(item.job_id),{cache:'no-store'});
     if(!status.ok)return;
     const state=await status.json();
     if(state.status==='completed'){
      const image=outputURL(state);
      setHistory(prev=>prev.map(x=>x.job_id===item.job_id?{...x,status:'completed',image_url:image}:x));
     }else if(state.status==='failed'){
      setHistory(prev=>prev.map(x=>x.job_id===item.job_id?{...x,status:'failed'}:x));
     }
    }));
   }
  }catch{setError('No se pudo consultar tu historial.');}
 }
 function chooseFile(next){
  if(!next)return;
  if(!['image/jpeg','image/png','image/webp'].includes(next.type)||next.size>10*1024*1024||next.size<1){
   setError('Utiliza JPG, PNG o WebP de máximo 10 MB.');return;
  }
  setFile(next);setResultUrl('');setError('');setNotice('');
 }
 function applyPreset(config,label){
  setForm({...DEFAULT,...config,product_name:'',product_benefit:'',price:''});
  setFile(null);setResultUrl('');setMode('create');setError('');setNotice('Configuración aplicada: '+label+'. Sube otro producto.');
 }
 async function savePreset(){
  if(guest){window.location.assign('/login');return;}
  if(busy)return;
  const title=presetTitle.trim()||((currentType?.label||'Imagen')+' · '+form.aspect_ratio);
  try{
   const r=await fetch('/api/realizo/images/presets',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({title,config:form})});
   const data=await r.json();
   if(!r.ok)throw Error(data.error||'No se pudo guardar');
   setNotice('Plantilla guardada. Podrás reutilizarla con otro producto.');
   setPresetTitle('');await loadPresets();
  }catch(e){setError(e.message);}
 }
 async function deletePreset(id){
  const r=await fetch('/api/realizo/images/presets/'+encodeURIComponent(id),{method:'DELETE'});
  if(r.ok){setPresets(prev=>prev.filter(x=>x.id!==id));setNotice('Plantilla eliminada.');}
  else setError('No se pudo eliminar la plantilla.');
 }
 async function poll(id,kind){
  const attempts=kind==='research'?65:205;
  for(let i=0;i<attempts;i++){
   await new Promise(resolve=>setTimeout(resolve,3000));
   const r=await fetch('/api/wallet/jobs/'+encodeURIComponent(id),{cache:'no-store'});
   const job=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(job.error||'No se pudo consultar el resultado.');
   if(job.status==='completed')return job;
   if(job.status==='failed')throw Error('La solicitud no se completó dentro del tiempo permitido. La reserva de esta etapa volvió a tu saldo.');
   if(job.status==='unknown')continue;
  }
  const e=Error('El límite de tiempo está cumplido. Consulta el estado para verificar la liberación de saldo.');e.pending=true;throw e;
 }
 async function run(){
  if(guest){window.location.assign('/login');return;}
  if(busy||!ready)return;
  if(!file){setError('Primero sube la fotografía de tu producto.');return;}
  if(mustPrice){setError('Introduce el precio que quieres mostrar en el anuncio.');return;}
  const brief={...form,product_name:form.product_name.trim(),product_benefit:form.product_benefit.trim(),
   price:form.show_price?form.price.trim():'',extra_instruction:form.extra_instruction.trim()};
  setError('');setNotice('');setResultUrl('');setBusy(true);setCurrentJob('');
  onGenerationStart?.();
  try{
   setPhase('Subiendo producto');
   const multipart=new FormData();multipart.append('product',file);
   const upload=await fetch('/api/realizo/images/upload',{method:'POST',body:multipart});
   const uploaded=await upload.json().catch(()=>({}));
   if(!upload.ok||!uploaded.upload_id)throw Error(uploaded.error||'No se pudo subir el producto.');
   setPhase('Analizando producto y ángulo de venta');
   const analysis=await fetch('/api/realizo/images/analyze',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({upload_id:uploaded.upload_id,brief,idempotency_key:crypto.randomUUID()})});
   const answer=await analysis.json().catch(()=>({}));
   if(!analysis.ok||!answer.job_id)throw Error(answer.error||'No se pudo analizar el producto.');
   setCurrentJob(answer.job_id);
   if(answer.status==='unknown')setNotice('Verificando la solicitud con Muapi…');
   await poll(answer.job_id,'research');
   setPhase('Generando creativo en 4K');
   const generation=await fetch('/api/realizo/images/generate',{method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({upload_id:uploaded.upload_id,research_job_id:answer.job_id,brief,
     idempotency_key:crypto.randomUUID()})});
   const created=await generation.json().catch(()=>({}));
   if(!generation.ok||!created.job_id)throw Error(created.error||'No se pudo generar la imagen.');
   setCurrentJob(created.job_id);
   if(created.status==='unknown')setNotice('Verificando la generación con Muapi…');
   const finished=await poll(created.job_id,'image');
   const url=outputURL(finished);
   if(!url)throw Error('La IA finalizó, pero no entregó una URL descargable.');
   setResultUrl(url);
   setNotice('Tu creativo está listo.');
   onGenerationComplete?.({url});
  }catch(e){setError(e.message||'Error al generar');onGenerationError?.(e.message);}
  finally{setBusy(false);setPhase('');onGenerationEnd?.();}
 }
 const changeMode=name=>{if(busy)return;setMode(name);setError('');setNotice('');};
 return <section className="ri-studio" aria-label="Generador de imágenes de Realizo">
  <div className="ri-header">
   <div><span className="ri-eyebrow">REALIZO · CREATIVOS ESTÁTICOS</span>
    <h1>Imágenes que <em>venden.</em></h1>
    <p>Tu producto, una idea comercial y una imagen lista para anunciar.</p>
   </div>
   <div className="ri-model-chip"><span>✳</span><strong>Imagen 4K</strong><small>Modelo automático</small></div>
  </div>
  <div className="ri-tabs" role="tablist" aria-label="Estudio de imágenes">
   <button type="button" role="tab" aria-selected={mode==='create'} className={mode==='create'?'selected':''} onClick={()=>changeMode('create')}>✳ Crear imagen</button>
   <button type="button" role="tab" aria-selected={mode==='presets'} className={mode==='presets'?'selected':''} onClick={()=>changeMode('presets')}>▦ Mis plantillas</button>
   <button type="button" role="tab" aria-selected={mode==='history'} className={mode==='history'?'selected':''} onClick={()=>changeMode('history')}>◫ Mis imágenes</button>
  </div>
  {mode==='create'&&<div className="ri-grid">
   <div className="ri-form">
    <section className="ri-card">
     <div className="ri-section-title"><span className="ri-num">01</span><div><h2>Tu producto</h2><p>Sube una foto clara del envase o producto real.</p></div></div>
     <input className="ri-visually-hidden" ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
      onChange={e=>chooseFile(e.target.files?.[0])}/>
     <button type="button" onClick={()=>inputRef.current?.click()} className="ri-upload">
      {preview?<img src={preview} alt="Tu producto" />:<span className="ri-upload-plus">＋</span>}
      <span><strong>{file?'Cambiar fotografía':'Subir imagen del producto'}</strong><small>{file?.name||'JPG, PNG o WebP · Hasta 10 MB'}</small></span><b>↗</b>
     </button>
     <div className="ri-fields">
      <label>Nombre del producto <span>opcional</span><input maxLength={90} value={form.product_name}
       onChange={e=>change('product_name',e.target.value)} placeholder="Ej. Sérum capilar"/></label>
      <label>Beneficio comprobable <span>opcional</span><input maxLength={220} value={form.product_benefit}
       onChange={e=>change('product_benefit',e.target.value)} placeholder="Ej. Ayuda a retirar residuos del cuero cabelludo"/></label>
     </div>
    </section>
    <section className="ri-card">
     <div className="ri-section-title"><span className="ri-num">02</span><div><h2>Cómo quieres que se vea</h2><p>Selecciona la intención visual de tu anuncio.</p></div></div>
     <div className="ri-field-label">Tipo de imagen</div>
     <div className="ri-type-grid">{TYPES.map(t=><button type="button" key={t.id} onClick={()=>change('creative_type',t.id)}
      className={'ri-type '+(form.creative_type===t.id?'is-selected':'')} aria-pressed={form.creative_type===t.id}>
       <strong>{t.label}</strong><small>{t.detail}</small></button>)}</div>
     <div className="ri-field-label">Acabado visual</div>
     <Choice options={STYLES} value={form.style} onChange={v=>change('style',v)}/>
     <div className="ri-field-label">Objetivo</div>
     <Choice options={GOALS} value={form.goal} onChange={v=>change('goal',v)}/>
    </section>
    <section className="ri-card">
     <div className="ri-section-title"><span className="ri-num">03</span><div><h2>Formato y precio</h2><p>Solo lo necesario para publicar.</p></div></div>
     <div className="ri-field-label">Formato</div>
     <Choice options={FORMATS} value={form.aspect_ratio} onChange={v=>change('aspect_ratio',v)} className="ri-formats"/>
     <div className="ri-field-label">Mostrar precio en la imagen</div>
     <Choice options={[{id:false,label:'Sin precio'},{id:true,label:'Con precio'}]} value={form.show_price}
      onChange={v=>change('show_price',v)}/>
     {form.show_price&&<label className="ri-price-field">Precio de venta <input maxLength={28} value={form.price}
      onChange={e=>change('price',e.target.value)} placeholder="Ej. $29.99" /></label>}
     <label className="ri-extra">Instrucción adicional <span>opcional</span>
      <textarea maxLength={500} rows={2} value={form.extra_instruction} onChange={e=>change('extra_instruction',e.target.value)}
       placeholder="Ej. Fondo azul, luz de estudio, público femenino…"/></label>
    </section>
   </div>
   <div className="ri-side">
    <div className="ri-preview-card">
     <div className="ri-preview-heading"><span>VISTA DE CONFIGURACIÓN</span><span>{form.aspect_ratio}</span></div>
     <div className={'ri-preview-visual ri-preview-'+form.creative_type} style={{aspectRatio:aspect}}>
      <span className="ri-preview-spark">✳</span>
      {preview?<img src={preview} alt="Foto del producto (previsualización, no imagen generada)"/>:<div className="ri-placeholder"><span>＋</span><small>Tu producto aquí</small></div>}
      <div className="ri-preview-bottom"><strong>{titleText}</strong><span>{currentType.label}</span>
       {form.show_price&&form.price.trim()&&<b>{form.price.trim()}</b>}</div>
     </div>
     <p>Referencia de distribución. La IA creará una escena nueva, no una copia de esta vista.</p>
    </div>
    <div className="ri-action-card">
     <span className="ri-eyebrow">LISTO PARA CREAR</span>
     <h3>Tu próximo anuncio comienza aquí.</h3>
     <p>La IA analiza el producto, elige un ángulo comercial y prepara el creativo automáticamente.</p>
     <div className="ri-cost"><div><span>Investigación + imagen 4K</span><strong>{money(total)}</strong></div>
      <small>Se descontará de tu saldo al generar; sin selección de modelo.</small></div>
     <button className="ri-generate" type="button" disabled={busy||!ready||(!guest&&!file)||mustPrice}
      onClick={run}>{busy?phase:(guest?'Iniciar sesión para crear':'Generar imagen')} <span>↗</span></button>
     {!ready&&<p className="ri-small-warning">El motor no está disponible en este momento.</p>}
     <div className="ri-save">
      <input type="text" maxLength={70} value={presetTitle} onChange={e=>setPresetTitle(e.target.value)}
       placeholder="Nombre de esta configuración" aria-label="Nombre de la plantilla"/>
      <button disabled={busy} type="button" onClick={savePreset}>Guardar plantilla</button>
     </div>
     <small className="ri-save-note">La plantilla guarda el estilo y los ajustes, nunca tu foto ni claves privadas.</small>
    </div>
    {resultUrl&&<div className="ri-result"><h3>Imagen generada</h3><img src={resultUrl} alt="Anuncio generado"/>
     <a href={resultUrl} target="_blank" rel="noopener noreferrer">Abrir y descargar imagen ↗</a>
     <button type="button" onClick={()=>{setResultUrl('');setNotice('Listo para crear otra variación.');}}>Crear otra variación</button></div>}
   </div>
  </div>}
  {mode==='presets'&&<div className="ri-library">
   <div className="ri-library-heading"><h2>Mis plantillas guardadas</h2><button type="button" onClick={()=>changeMode('create')}>+ Crear nueva</button></div>
   {guest?<p>Inicia sesión para guardar tus configuraciones.</p>:presets.length===0?<div className="ri-empty"><span>▦</span><h3>Aún no tienes plantillas.</h3><p>Configura una imagen y pulsa Guardar plantilla para reutilizar el estilo.</p></div>:
   <div className="ri-list">{presets.map(p=><article key={p.id} className="ri-list-card">
    <span>✳</span><div><strong>{p.title}</strong><small>{TYPES.find(t=>t.id===p.config.creative_type)?.label||'Imagen'} · {p.config.aspect_ratio} · {p.config.show_price?'Con precio':'Sin precio'}</small></div>
    <button type="button" onClick={()=>applyPreset(p.config,p.title)}>Usar plantilla</button>
    <button type="button" className="ri-delete" aria-label={'Eliminar '+p.title} onClick={()=>deletePreset(p.id)}>✕</button>
   </article>)}</div>}
  </div>}
  {mode==='history'&&<div className="ri-library">
   <div className="ri-library-heading"><h2>Mis imágenes</h2><button type="button" onClick={loadHistory}>Actualizar</button></div>
   {guest?<p>Inicia sesión para consultar tus imágenes.</p>:history.length===0?<div className="ri-empty"><span>◫</span><h3>Tu primera imagen está por llegar.</h3><p>Genera un anuncio y aparecerá aquí.</p></div>:
   <div className="ri-history-grid">{history.map(item=><article className="ri-history-card" key={item.id}>
    <div className="ri-history-picture">{item.image_url?<img src={item.image_url} alt={'Resultado '+(item.config.product_name||'publicitario')}/>:<span>{item.status==='completed'?'Resultado no disponible':item.status==='failed'?'Error':'En proceso'}</span>}</div>
    <strong>{item.config.product_name||'Anuncio publicitario'}</strong>
    <small>{item.config.aspect_ratio||'4:5'} · {item.created_at}</small>
    <div>{item.image_url&&<a href={item.image_url} target="_blank" rel="noopener noreferrer">Ver imagen ↗</a>}
     <button type="button" onClick={()=>applyPreset(item.config,item.config.product_name||'anuncio')}>Reutilizar estilo</button></div>
   </article>)}</div>}
  </div>}
  {error&&<div className="ri-error" role="alert">{error}{currentJob&&<small> Solicitud: {currentJob}</small>}</div>}
  {notice&&<div className="ri-notice" role="status">{notice}</div>}
 </section>;
}
