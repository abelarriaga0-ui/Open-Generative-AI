'use client';
import {useEffect,useRef,useState} from 'react';
import {optimizeImage} from '@/lib/realizo-creative/optimize-image';

const angles=[
 ['auto','Que la IA investigue y elija'],['problem','Problema → solución'],
 ['premium','Premium / lujo'],['benefits','Beneficio directo'],
 ['sensory','Sensorial / emocional'],['demo','Demostración'],
 ['lifestyle','Lifestyle'],['ugc','UGC actuado'],['offer','Oferta confirmada']
];
const markets=[['EC','Ecuador'],['CO','Colombia'],['MX','México'],['PE','Perú'],
 ['CL','Chile'],['GT','Guatemala'],['US','Estados Unidos'],['ES','España'],
 ['AR','Argentina'],['PA','Panamá'],['CR','Costa Rica']];
const field='w-full rounded-2xl border border-[#E6DCE9] bg-white px-4 py-3 text-[#2C2341] outline-none focus:border-[#8B65D1]';
const card='rounded-[24px] border border-[#E9DFE6] bg-white p-5 sm:p-7 shadow-sm';
const fmt=status=>({
 created:'Preparando',researching:'Investigando producto y mercado',
 ready:'Conceptos preparados',needs_review:'Revisar información del producto',
 approved:'Concepto aprobado',failed:'Investigación no completada',
})[status]||status;

export default function RealizoPremium({onPrepare,onOpenAdvanced,onUseAutomatic}){
 const [config,setConfig]=useState(null),[image,setImage]=useState(null);
 const [product,setProduct]=useState({product_name:'',description:'',audience:'',
  angle:'auto',market:'EC',cta:''});
 const [project,setProject]=useState(null),[selection,setSelection]=useState(0);
 const [editedPrompt,setEditedPrompt]=useState(''),[correction,setCorrection]=useState('');
 const [ack,setAck]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const fileRef=useRef(null),keyRef=useRef(null);
 useEffect(()=>{
  let active=true;
  fetch('/api/realizo/ai-premium',{cache:'no-store',credentials:'same-origin'})
   .then(r=>r.ok?r.json():Promise.reject()).then(async v=>{
     if(!active)return;
     setConfig(v);
     const latest=v.projects?.[0];
     if(latest?.id){
       try {
         const response=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(latest.id),{
           cache:'no-store',credentials:'same-origin'
         });
         if(response.ok&&active)setProject(await response.json());
       }catch{}
     }
   })
   .catch(()=>{if(active)setConfig({enabled:false,message:'No disponible en este momento.'})});
  return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!project?.id || !['created','researching'].includes(project.status))return;
  let active=true;
  const poll=async()=>{
   try{
    const r=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(project.id),{cache:'no-store'});
    if(!r.ok)return;
    const result=await r.json();
    if(active)setProject(result);
   }catch{}
  };
  const timer=setInterval(poll,5500);
  return()=>{active=false;clearInterval(timer)};
 },[project?.id,project?.status]);
 useEffect(()=>{
  if(project?.concepts?.length===3){
   const i=Number.isInteger(project.findings?.recommended_index)?
    Math.max(0,Math.min(2,project.findings.recommended_index)):0;
   setSelection(i);
  }
 },[project?.id,project?.concepts]);
 useEffect(()=>{
  setEditedPrompt(project?.concepts?.[selection]?.video_prompt||'');
 },[project?.concepts,selection]);
 const change=(k,v)=>{setProduct(p=>({...p,[k]:v}));keyRef.current=null};
 const upload=async(file)=>{
  if(!file)return;
  setBusy(true);setError('');
  try{
   if(!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>8*1024*1024)
    throw Error('La foto debe ser JPG, PNG o WEBP, máximo 8 MB.');
   const optimized=await optimizeImage(file);
   const data=new FormData();data.append('image',optimized);
   const r=await fetch('/api/realizo/media',{method:'POST',body:data});
   const json=await r.json().catch(()=>({}));
   if(!r.ok||!json.id||!json.url)throw Error('No se pudo guardar la fotografía.');
   setImage({id:json.id,url:json.url});keyRef.current=null;
  }catch(e){setError(e.message)}finally{setBusy(false)}
 };
 const start=async()=>{
  if(!config?.enabled)return setError('La IA Premium necesita una conexión OpenAI autorizada. El modo automático sigue disponible.');
  if(!image?.id || product.description.trim().length<15)
   return setError('Sube una imagen y explica brevemente qué vendes (15 caracteres o más).');
  setBusy(true);setError('');
  if(!keyRef.current)keyRef.current=crypto.randomUUID();
  try{
   const r=await fetch('/api/realizo/ai-premium',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...product,primary_asset_id:image.id,request_key:keyRef.current}),
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(json.error==='ai_premium_daily_limit'?
     'Ya usaste la investigación de prueba disponible hoy.':'No se pudo iniciar la investigación: '+(json.error||r.status));
   setProject(json);
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const approve=async()=>{
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(project.id)+'/approve',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({index:selection,prompt:editedPrompt,acknowledged_conflicts:ack,correction}),
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(json.error==='resolve_product_conflict_first'?
    'Confirma la información correcta del producto antes de aprobar.':
    'No se pudo aprobar: '+(json.error||r.status));
   if(!json.ready_for_editor)throw Error('El editor no recibió el proyecto.');
   setProject(json);onPrepare(json.ready_for_editor);onOpenAdvanced();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const findings=project?.findings||{};
 const concepts=project?.concepts||[];
 const ready=concepts.length===3 && ['ready','needs_review','approved'].includes(project?.status);
 return <div className="max-w-[1160px] mx-auto space-y-5">
  <div className="rounded-[25px] bg-gradient-to-r from-[#38244E] to-[#6D47AE] p-6 sm:p-8 text-white">
   <p className="text-xs font-bold tracking-[.19em] uppercase text-[#F8C3C5]">Realizo AI Premium</p>
   <h2 className="text-[27px] sm:text-[36px] font-extrabold mt-2">Tu agencia creativa con IA.</h2>
   <p className="text-sm text-[#EEE2F6] max-w-2xl mt-2 leading-6">
    Sube la foto, describe el producto y elige el mercado. La IA investiga y prepara tres anuncios para que tú decidas.
   </p>
   <p className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold">
    {config?.enabled?'Beta privada · $0 adicionales de investigación · video cotizado aparte':
     'Investigación IA pendiente de activar · no habrá cobros'}
   </p>
  </div>
  {error&&<div role="alert" className="rounded-2xl border border-[#EEB9AB] bg-[#FFF0E9] px-5 py-3 text-sm text-[#914F40]">{error}</div>}
  {!project&&<div className="grid lg:grid-cols-[.9fr_1.1fr] gap-5">
   <section className={card+' space-y-4'}>
    <h3 className="text-xl font-extrabold">1. Tu producto</h3>
    <button type="button" disabled={busy} onClick={()=>fileRef.current?.click()}
      className="w-full h-[240px] border-2 border-dashed border-[#CBB1E7] rounded-[20px] bg-[#F8F3FD] flex flex-col items-center justify-center gap-3 overflow-hidden">
      {image?<><img src={image.url} alt="Producto cargado" className="max-w-full h-[170px] object-contain"/>
        <span className="text-xs font-bold text-[#6545A1]">Cambiar fotografía</span></>:
       <><span className="text-4xl">✦</span><strong>Subir fotografía principal</strong><span className="text-xs text-[#8B789A]">JPG, PNG o WEBP · máximo 8 MB</span></>}
    </button>
    <input type="file" ref={fileRef} accept="image/jpeg,image/png,image/webp" className="hidden"
      onChange={e=>{upload(e.target.files?.[0]);e.target.value=''}}/>
    <p className="text-xs text-[#86758B]">La fotografía define el envase y la etiqueta. La IA señalará las discrepancias, no inventará características.</p>
   </section>
   <section className={card+' space-y-4'}>
    <h3 className="text-xl font-extrabold">2. Información y estrategia</h3>
    <label className="block text-sm font-bold">Nombre del producto (opcional)
      <input className={field+' mt-2'} maxLength={100} value={product.product_name}
       onChange={e=>change('product_name',e.target.value)} placeholder="Ej. NOIL Body Wash"/>
    </label>
    <label className="block text-sm font-bold">Descripción breve *
     <textarea className={field+' mt-2 min-h-[110px]'} maxLength={1600} value={product.description}
      onChange={e=>change('description',e.target.value)}
      placeholder="¿Qué vendes, para quién y qué beneficio puedes confirmar?"/>
    </label>
    <div className="grid sm:grid-cols-2 gap-4">
     <label className="block text-sm font-bold">País objetivo
       <select className={field+' mt-2'} value={product.market} onChange={e=>change('market',e.target.value)}>
        {markets.map(([v,n])=><option key={v} value={v}>{n}</option>)}
       </select>
     </label>
     <label className="block text-sm font-bold">Ángulo de venta
       <select className={field+' mt-2'} value={product.angle} onChange={e=>change('angle',e.target.value)}>
        {angles.map(([v,n])=><option key={v} value={v}>{n}</option>)}
       </select>
     </label>
    </div>
    <label className="block text-sm font-bold">Público objetivo (opcional)
     <input className={field+' mt-2'} maxLength={180} value={product.audience}
      onChange={e=>change('audience',e.target.value)} placeholder="Ej. Hombres de 18 a 40 años"/>
    </label>
    <label className="block text-sm font-bold">Llamada a la acción (opcional)
     <input className={field+' mt-2'} maxLength={120} value={product.cta}
      onChange={e=>change('cta',e.target.value)} placeholder="Ej. Paga al recibir"/>
    </label>
    <p className="text-xs text-[#7D6B8A] rounded-xl bg-[#F8F3FC] p-3">
     En la beta privada no se cobra la investigación a tu saldo de Muapi. El costo de cada video se confirmará después.
     Los anuncios de terceros solo se analizarán cuando exista acceso público y verificable.
    </p>
    <div className="flex flex-wrap gap-3">
     <button type="button" disabled={busy||!config?.enabled||!image}
      onClick={start} className="rounded-2xl bg-[#704CD4] disabled:opacity-45 text-white px-6 py-3 font-bold">
      {busy?'Preparando…':'✦ Investigar y crear 3 conceptos'}
     </button>
     <button type="button" onClick={onUseAutomatic}
      className="rounded-2xl border border-[#DCCEE9] px-5 py-3 text-[#684C98] font-bold">Usar modo gratis</button>
    </div>
    {!config?.enabled&&<p role="status" className="text-xs text-[#9A6A58]">
     {config?.message||'Comprobando disponibilidad de OpenAI…'} No se ha descontado ningún crédito.
    </p>}
   </section>
  </div>}
  {project&&<section className={card+' space-y-5'}>
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><p className="text-xs font-bold tracking-widest text-[#7F5FB1]">PROYECTO PREMIUM</p>
        <h3 className="text-2xl font-extrabold mt-2">{project.product_name||'Tu producto'}</h3></div>
      <span className="rounded-full bg-[#EEE4FA] text-[#673E9A] font-bold text-xs px-4 py-2">{fmt(project.status)}</span>
    </div>
    {['created','researching'].includes(project.status)&&<div className="p-6 rounded-2xl bg-[#F8F4FC]">
      <p className="font-semibold">Estamos analizando la imagen y fuentes de mercado.</p>
      <p className="text-sm text-[#7D718A] mt-2">Puedes mantener abierta esta pantalla. La consulta recupera el mismo proyecto; no inicia nuevas investigaciones ni videos.</p>
    </div>}
    {project.status==='failed'&&<p className="text-sm text-[#9A6257]">La investigación no pudo completarse. No se ha cobrado al cliente. Puedes utilizar el modo automático sin costo adicional.</p>}
    {project.status==='needs_review'&&!ready&&<p className="text-sm text-[#9A6257]">La llamada de OpenAI necesita revisión antes de volver a intentarse. No se volverá a cobrar automáticamente.</p>}
    {ready&&<>
      <div className="rounded-2xl bg-[#F8F5F0] p-5 space-y-2">
       <h4 className="font-extrabold">Informe de producto y mercado</h4>
       <p className="text-sm">{findings.product_observation}</p>
       <p className="text-sm text-[#6A5C74]">{findings.market_summary}</p>
       {(findings.claims_to_verify||[]).length>0&&<p className="text-xs text-[#995E4A]">
        Por verificar: {findings.claims_to_verify.join(' · ')}</p>}
       {(findings.research_limitations||[]).length>0&&<p className="text-xs text-[#796C7F]">
        Alcance: {findings.research_limitations.join(' · ')}</p>}
      </div>
      {(findings.description_conflicts||[]).length>0&&<div className="rounded-2xl border border-[#EBC8A8] bg-[#FFF8EC] p-4 space-y-3">
        <p className="font-extrabold text-[#805D42]">Debes confirmar información del producto</p>
        {(findings.description_conflicts||[]).map((x,i)=><p className="text-sm" key={i}>• {x}</p>)}
        <textarea className={field} value={correction} maxLength={700}
          onChange={e=>setCorrection(e.target.value)} placeholder="Escribe cuál es el producto real y la característica correcta…"/>
        <label className="flex gap-2 items-center text-sm">
          <input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>
          Confirmo que revisé la fotografía y corregí la ficha antes de publicar.
        </label>
      </div>}
      <div className="grid md:grid-cols-3 gap-4">
       {concepts.map((c,i)=><button type="button" key={i} onClick={()=>setSelection(i)}
        className={'rounded-[20px] p-4 text-left border-2 transition '+(selection===i?'border-[#8054C9] bg-[#F4EDFD]':'border-[#E7DEEA] bg-white')}>
        <p className="text-xs font-bold uppercase tracking-wide text-[#8E64C0]">{['A','B','C'][i]} · {c.angle}</p>
        <p className="text-lg font-extrabold mt-2">{c.name}</p><p className="text-sm mt-2">“{c.hook}”</p>
        <p className="text-xs text-[#81728A] mt-3">{c.reason}</p>
       </button>)}
      </div>
      {concepts[selection]&&<div className="space-y-3">
        <h4 className="font-extrabold">Guion y planos seleccionados</h4>
        <p className="text-sm">{concepts[selection].script}</p>
        <ul className="text-sm space-y-1 list-disc pl-5 text-[#655875]">
          {concepts[selection].shots.map((shot,i)=><li key={i}>{shot}</li>)}
        </ul>
        <label className="block text-sm font-bold">Prompt audiovisual editable
          <textarea value={editedPrompt} onChange={e=>setEditedPrompt(e.target.value)}
            className={field+' mt-2 min-h-[170px]'} maxLength={5500}/>
        </label>
        <p className="text-xs text-[#7B6E87]">Los textos y el CTA pueden añadirse posteriormente como superposiciones para preservar la etiqueta.</p>
      </div>}
      <div className="rounded-2xl border border-[#EAE0EF] p-4">
       <h4 className="font-bold text-sm">Fuentes consultadas</h4>
       {project.sources?.length?
        <ul className="mt-2 space-y-2 text-xs">{project.sources.map((x,i)=><li key={i}>
         <a href={x.url} target="_blank" rel="noreferrer" className="underline text-[#7254B6]">{x.title||x.url}</a>
        </li>)}</ul>:
        <p className="mt-2 text-xs text-[#9B7759]">No hay fuentes web verificables en este informe. No deben interpretarse como datos de ventas confirmados.</p>}
      </div>
      <button type="button" onClick={approve} disabled={busy}
        className="rounded-2xl bg-[#6D48CB] text-white font-bold py-3.5 px-6 disabled:opacity-50">
        {busy?'Guardando…':'Aprobar concepto y elegir modelo Muapi'}
      </button>
      <p className="text-xs text-[#86788F]">La aprobación no genera ni cobra un video. El editor mostrará su precio antes del envío.</p>
    </>}
  </section>}
 </div>;
}
