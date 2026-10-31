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
 ['AR','Argentina'],['PA','Panamá'],['CR','Costa Rica'],['UY','Uruguay'],
 ['PY','Paraguay'],['BO','Bolivia'],['VE','Venezuela'],['NI','Nicaragua'],
 ['HN','Honduras'],['SV','El Salvador'],['DO','República Dominicana'],
 ['PR','Puerto Rico'],['CU','Cuba'],['BR','Brasil'],['CA','Canadá'],
 ['GB','Reino Unido'],['FR','Francia'],['DE','Alemania'],['IT','Italia'],
 ['PT','Portugal'],['AU','Australia'],['JP','Japón'],['IN','India'],
 ['AE','Emiratos Árabes Unidos']];
const languages=[['es','Español'],['en','English'],['pt','Português'],['fr','Français'],['de','Deutsch'],['it','Italiano']];
const previews={ugc:{icon:'🎙️',label:'UGC'},problem:{icon:'⚡',label:'Problema-solución'},premium:{icon:'🎬',label:'Cinematográfico'},benefits:{icon:'✨',label:'Beneficios'},sensory:{icon:'🌙',label:'Sensorial'},demo:{icon:'🧴',label:'Demostración'}};
const visualFor=c=>previews[String(c.angle||'').toLowerCase().split(/[ :/]/)[0]]||(/ugc/i.test(c.name||'')?previews.ugc:previews.benefits);
// A familiar provider → version → creation-mode selector, backed by the exact
// same server-validated endpoint catalog. No extra paid AI calls on selection.
const preferredVideoModel=options=>{
 const candidates=options.filter(m=>m.family_id==='seedance-2.5');
 const pool=candidates.length?candidates:options;
 return pool.find(m=>m.image_role==='product_reference')
   ||pool.find(m=>m.image_role==='start_frame')||pool[0]||null;
};
const preferredDuration=(model,previous)=>{
 if(model?.durations?.includes(Number(previous)))return Number(previous);
 return model?.durations?.includes(8)?8:model?.durations?.[0]??'';
};
const videoModes={
 product_reference:['🖼️','Imagen de referencia','Crea escenas nuevas conservando el aspecto del producto'],
 start_frame:['▶️','Animar fotografía','El video comienza desde la foto cargada'],
 none:['✍️','Sin referencia','Este motor no garantiza conservar la fotografía']
};

const creativeStyles=[['auto','✨','IA decide'],['ugc','🤳','UGC'],['cinematic','🎥','Cine'],['premium','💎','Premium'],['demo','🧴','Demo']];
const field='w-full rounded-2xl border border-[#E6DCE9] bg-white px-4 py-3 text-[#2C2341] outline-none focus:border-[#8B65D1]';
const card='rounded-[24px] border border-[#E9DFE6] bg-white p-5 sm:p-7 shadow-sm';
const fmt=status=>({
 created:'Preparando',researching:'Investigando producto y mercado',
 ready:'Conceptos preparados',needs_review:'Revisar información del producto',
 approved:'Concepto aprobado',failed:'Investigación no completada',
})[status]||status;

export default function RealizoPremium({onPrepare,onOpenAdvanced,onUseAutomatic,onCreateNew,onWalletRefresh,initialProjectId=null}){
 const [config,setConfig]=useState(null),[image,setImage]=useState(null);
 const [product,setProduct]=useState({product_name:'',description:'',audience:'',
  angle:'auto',market:'EC',video_language:'es',cta:'',creative_style:'ugc',video_model_id:'',video_duration_seconds:''});
 const [project,setProject]=useState(null),[selection,setSelection]=useState(0);
 const [editedPrompt,setEditedPrompt]=useState('');
 const [editedSpeech,setEditedSpeech]=useState('');
 const [style,setStyle]=useState('ugc'),[shotPreference,setShotPreference]=useState('auto');
 const [acknowledged,setAcknowledged]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const fileRef=useRef(null),keyRef=useRef(null);
 useEffect(()=>{
  let active=true;
  fetch('/api/realizo/ai-premium',{cache:'no-store',credentials:'same-origin'})
   .then(r=>r.ok?r.json():Promise.reject()).then(async v=>{
     if(!active)return;
     setConfig(v);
     // Choose Seedance 2.5 as the starting engine; users can change freely
     // before committing the single paid investigation.
     const recommended=preferredVideoModel(v.video_options||[]);
     if(recommended)setProduct(prev=>prev.video_model_id?prev:{
      ...prev,video_model_id:recommended.id,
      video_duration_seconds:preferredDuration(recommended,prev.video_duration_seconds),
     });
     // Fresh creation is the default. Only restore a previous investigation
     // after the owner explicitly selects it from "Mis videos".
     if(initialProjectId){
       try{
         const response=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(initialProjectId),{
           cache:'no-store',credentials:'same-origin'
         });
         if(!response.ok)throw new Error('No se pudo recuperar la investigación');
         const saved=await response.json();
         if(active)setProject(saved);
       }catch{
         if(active)setError('No se pudo abrir el proyecto guardado. Puedes comenzar uno nuevo.');
       }
     }
   })
   .catch(()=>{if(active)setConfig({enabled:false,message:'No disponible en este momento.'})});
  return()=>{active=false};
 },[initialProjectId]);
 useEffect(()=>{
  if(!project?.id || !['created','researching'].includes(project.status))return;
  let active=true;
  const poll=async()=>{
   try{
    const r=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(project.id),{cache:'no-store'});
    if(!r.ok)return;
    const result=await r.json();
    if(active){
      setProject(result);
      if(!['created','researching'].includes(result.status))onWalletRefresh?.();
    }
   }catch{}
  };
  const timer=setInterval(poll,5500);
  return()=>{active=false;clearInterval(timer)};
 },[project?.id,project?.status,onWalletRefresh]);
 useEffect(()=>{
  if(project?.concepts?.length===3){
   const i=Number.isInteger(project.findings?.recommended_index)?
    Math.max(0,Math.min(2,project.findings.recommended_index)):0;
   setSelection(i);
  }
 },[project?.id,project?.concepts]);
 useEffect(()=>{
  setEditedPrompt(project?.concepts?.[selection]?.video_prompt||'');
  setEditedSpeech(project?.concepts?.[selection]?.spoken_script||project?.concepts?.[selection]?.script||'');
 },[project?.concepts,selection]);
 useEffect(()=>{
  if(project?.id)setStyle(project.creative_style||'auto');
 },[project?.id,project?.creative_style]);
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
  if(!config?.enabled)return setError('Realizo AI Premium necesita una conexión autorizada y saldo real cuando corresponde.');
  if(!image?.id || product.description.trim().length<15)
    return setError('Sube una foto y describe el producto en al menos 15 caracteres.');
  const chosen=(config.video_options||[]).find(m=>m.id===product.video_model_id);
  if(!chosen || !chosen.durations.includes(Number(product.video_duration_seconds)))
    return setError('Selecciona un motor de video y una duración compatible antes de investigar.');
  const price=config.customer_charge_cents;
  if(!Number.isInteger(price)||price<0)return setError('No se pudo cotizar la investigación.');
  if(config.billing_mode!=='paid'||price<=0||config.general_available_cents<price)
    return setError('Saldo real insuficiente para pagar la investigación. Necesitas fondos verificados.');
  const message='Investigación IA: USD '+(price/100).toFixed(2)+
    '. Modelo '+chosen.name+', duración '+product.video_duration_seconds+' segundos, estilo '+product.creative_style+'. Se reservará de tu billetera ahora y se cobrará al entregar los 3 conceptos. El video se cotiza aparte. ¿Confirmas el pago?';
  if(!window.confirm(message))return;
  setBusy(true);setError('');
  if(!keyRef.current)keyRef.current=crypto.randomUUID();
  try{
   const r=await fetch('/api/realizo/ai-premium',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...product,primary_asset_id:image.id,request_key:keyRef.current,
      max_price_cents:price,pricing_version:config.pricing_version}),
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(json.error==='ai_premium_daily_limit'?
     'Has alcanzado el límite de investigaciones del día.':
     json.error==='insufficient_general_funds'||json.error==='verified_real_topup_required'?
     'Necesitas saldo de una recarga real verificada.':
     json.error==='price_changed_confirm_again'?'El precio cambió. Actualiza y confírmalo nuevamente.':
     json.error==='invalid_video_configuration'?'El modelo o duración elegidos ya no están disponibles. Selecciona otra combinación.':
     'No se pudo iniciar la investigación: '+(json.error||r.status));
   setProject(json);
   onWalletRefresh?.();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const approve=async()=>{
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(project.id)+'/approve',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({index:selection,prompt:editedPrompt,speech:editedSpeech,style,
     shot_preference:shotPreference,acknowledged_responsibility:acknowledged}),
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(json.error==='ugc_speech_timing_invalid'?
    'Ajusta el diálogo UGC para que encaje en los segundos elegidos. No se cobrará otra investigación.':
    json.error==='review_product_responsibility'?
    'Acepta la declaración de responsabilidad comercial antes de aprobar.':
    'No se pudo aprobar: '+(json.error||r.status));
   if(!json.ready_for_editor)throw Error('El editor no recibió el proyecto.');
   setProject(json);onPrepare(json.ready_for_editor);onOpenAdvanced();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 const findings=project?.findings||{};
 const concepts=project?.concepts||[];
 const videoOptions=config?.video_options||[];
 const selectedModel=videoOptions.find(m=>m.id===product.video_model_id);
 const availableDurations=selectedModel?.durations||[];
 const spokenWords=editedSpeech.trim()?editedSpeech.trim().split(/\s+/).length:0;
 const durationSpeech=Number(project?.video_duration_seconds)||8;
 const speechMin=Math.max(5,Math.floor(durationSpeech*1.4));
 const speechMax=Math.floor(durationSpeech*2.4);
 const selectedProvider=selectedModel?.provider||'';
 const selectedFamily=selectedModel?.family_id||'';
 const providerOptions=Array.from(new Map(videoOptions.map(m=>[
   m.provider,{id:m.provider,name:m.provider_name||m.provider}
 ])).values()).sort((a,b)=>a.name.localeCompare(b.name,'es'));
 const providerModels=videoOptions.filter(m=>m.provider===selectedProvider);
 const familyOptions=Array.from(new Map(providerModels.map(m=>[
   m.family_id,{id:m.family_id,name:m.family}
 ])).values()).sort((a,b)=>b.name.localeCompare(a.name,'es',{numeric:true}));
 const familyModels=providerModels.filter(m=>m.family_id===selectedFamily);
 const availableModes=Object.keys(videoModes).filter(role=>familyModels.some(m=>m.image_role===role));
 const variantsForMode=familyModels.filter(m=>m.image_role===selectedModel?.image_role);
 const chooseVideoModel=next=>{
   if(!next)return;
   setProduct(prev=>({
    ...prev,video_model_id:next.id,
    video_duration_seconds:preferredDuration(next,prev.video_duration_seconds),
   }));
   keyRef.current=null;
 };
 const ready=concepts.length===3 && ['ready','needs_review','approved'].includes(project?.status);
 return <div className="max-w-[1160px] mx-auto space-y-5">
  <div className="rounded-[25px] bg-gradient-to-r from-[#38244E] to-[#6D47AE] p-6 sm:p-8 text-white">
   <p className="text-xs font-bold tracking-[.19em] uppercase text-[#F8C3C5]">Realizo AI Premium</p>
   <h2 className="text-[27px] sm:text-[36px] font-extrabold mt-2">Tu agencia creativa con IA.</h2>
   <p className="text-sm text-[#EEE2F6] max-w-2xl mt-2 leading-6">
    Sube la foto, describe el producto y elige el mercado. La IA investiga y prepara tres anuncios para que tú decidas.
   </p>
   <p className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold">
    {config?.enabled && config.customer_charge_cents>0?
      'Investigación IA: USD '+(config.customer_charge_cents/100).toFixed(2)+' · Video aparte':
      'Precio de investigación no disponible'}
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
    <label className="block text-sm font-bold">Idioma de voz y video
     <select className={field+' mt-2'} value={product.video_language} onChange={e=>change('video_language',e.target.value)}>
      {languages.map(([code,name])=><option key={code} value={code}>{name}</option>)}
     </select>
    </label>
    <div className="rounded-2xl border border-[#D8C5EF] bg-[#F9F5FF] p-4 space-y-3">
     <p className="text-sm font-extrabold">3. Configura el video antes de investigar</p>
     <p className="text-xs text-[#765E90]">Elige cómo venderás y con qué motor, antes del único cobro de investigación.</p>
     <div className="space-y-2">
      <p className="text-sm font-bold">Formato publicitario</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
       {creativeStyles.map(([id,icon,label])=><button type="button" key={id}
        aria-pressed={product.creative_style===id} onClick={()=>change('creative_style',id)}
        className={'rounded-xl border-2 px-2 py-3 text-center transition '+(
         product.creative_style===id?'border-[#7650C6] bg-white shadow-sm':
          'border-[#E7DEEC] bg-white/60 hover:bg-white')}>
        <span className="block text-xl" aria-hidden="true">{icon}</span>
        <span className="block mt-1 text-xs font-bold">{label}</span>
       </button>)}
      </div>
      {product.creative_style==='ugc'&&
       <p className="text-xs text-[#6D518D]">UGC: una persona habla mirando a cámara, explica el producto, engancha desde el inicio y termina invitando a comprar.</p>}
     </div>

     <div className="grid sm:grid-cols-2 gap-3">
      <label className="block text-sm font-bold">Proveedor
       <select className={field+' mt-2'} value={selectedProvider}
        onChange={e=>chooseVideoModel(preferredVideoModel(
         videoOptions.filter(m=>m.provider===e.target.value)))}>
        {providerOptions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
       </select>
      </label>
      <label className="block text-sm font-bold">Modelo y versión
       <select className={field+' mt-2'} value={selectedFamily}
        onChange={e=>chooseVideoModel(preferredVideoModel(
         providerModels.filter(m=>m.family_id===e.target.value)))}>
        {familyOptions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
       </select>
      </label>
     </div>
     {!!availableModes.length&&<div className="space-y-2">
      <p className="text-sm font-bold">¿Cómo quieres crear el video?</p>
      <div className="grid sm:grid-cols-3 gap-2">
       {availableModes.map(mode=>{
        const [emoji,label,description]=videoModes[mode];
        return <button key={mode} type="button" onClick={()=>chooseVideoModel(preferredVideoModel(
          familyModels.filter(m=>m.image_role===mode)))}
          aria-pressed={selectedModel?.image_role===mode}
          className={'rounded-xl border-2 p-3 text-left transition '+(
           selectedModel?.image_role===mode
            ?'border-[#7B4FC9] bg-white shadow-sm':'border-[#E2D5EC] bg-white/50 hover:bg-white')}>
          <span className="text-lg" aria-hidden="true">{emoji}</span>
          <p className="text-xs font-bold mt-1">{label}</p>
          <p className="text-[11px] leading-4 text-[#806F91] mt-1">{description}</p>
         </button>;
       })}
      </div>
     </div>}
     {variantsForMode.length>1&&<details className="rounded-xl border border-[#E4D8ED] bg-white p-3">
      <summary className="text-xs font-bold text-[#6B4C94] cursor-pointer">
       Opciones avanzadas del motor · {variantsForMode.length} variantes
      </summary>
      <label className="block text-xs font-bold mt-3">Variante específica
       <select className={field+' mt-2 text-sm'} value={product.video_model_id}
        onChange={e=>chooseVideoModel(variantsForMode.find(m=>m.id===e.target.value))}>
        {variantsForMode.map(model=><option key={model.id} value={model.id}>
         {model.variant_label||model.name}
        </option>)}
       </select>
      </label>
     </details>}
     {selectedModel&&<>
      <label className="block text-sm font-bold">Duración disponible
       <select className={field+' mt-2'} value={product.video_duration_seconds}
        onChange={e=>change('video_duration_seconds',Number(e.target.value))}>
        {availableDurations.map(n=><option key={n} value={n}>{n} segundos</option>)}
       </select>
      </label>
      <p className="text-xs text-[#71588B]">
       Seleccionado: <strong>{selectedModel.family}</strong> · {videoModes[selectedModel.image_role]?.[1]||selectedModel.name} · {product.video_duration_seconds} s.
       {' '}{selectedModel.note}
      </p>
     </>}
    </div>
    <label className="block text-sm font-bold">Público objetivo (opcional)
     <input className={field+' mt-2'} maxLength={180} value={product.audience}
      onChange={e=>change('audience',e.target.value)} placeholder="Ej. Hombres de 18 a 40 años"/>
    </label>
    <label className="block text-sm font-bold">Llamada a la acción (opcional)
     <input className={field+' mt-2'} maxLength={120} value={product.cta}
      onChange={e=>change('cta',e.target.value)} placeholder="Ej. Paga al recibir"/>
    </label>
    <p className="text-xs text-[#755F88] rounded-xl bg-[#F8F3FC] p-3">
     Precio fijo: <strong>USD {((config?.customer_charge_cents||0)/100).toFixed(2)}</strong> por investigar y crear 3 conceptos. El video se cobra aparte.
    </p>
    <div className="flex flex-wrap gap-3">
     <button type="button" disabled={busy||!config?.enabled||!image||!selectedModel||!product.video_duration_seconds}
      onClick={start} className="rounded-2xl bg-[#704CD4] disabled:opacity-45 text-white px-6 py-3 font-bold">
      {busy?'Investigando…':'✦ Investigar y pagar $'+((config?.customer_charge_cents||0)/100).toFixed(2)}
     </button>
     <button type="button" onClick={onUseAutomatic}
      className="rounded-2xl border border-[#DCCEE9] px-5 py-3 text-[#684C98] font-bold">Usar modo gratis</button>
    </div>
    {!config?.enabled&&<p role="status" className="text-xs text-[#9A6A58]">
     {config?.message||'Comprobando disponibilidad de Realizo AI…'} No se ha descontado ningún crédito.
    </p>}
   </section>
  </div>}
  {project&&<section className={card+' space-y-5'}>
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><p className="text-xs font-bold tracking-widest text-[#7F5FB1]">PROYECTO PREMIUM</p>
        <h3 className="text-2xl font-extrabold mt-2">{project.product_name||'Tu producto'}</h3></div>
      <div className="flex flex-wrap items-center gap-2">
       <span className="rounded-full bg-[#EEE4FA] text-[#673E9A] font-bold text-xs px-4 py-2">{fmt(project.status)}</span>
       <button type="button" disabled={busy} onClick={onCreateNew}
         className="rounded-2xl bg-[#6D48CB] text-white px-4 py-2 text-xs font-bold hover:bg-[#5B37BA] disabled:opacity-50">
         + Crear otro video
       </button>
      </div>
    </div>
    {['created','researching'].includes(project.status)&&<div className="p-6 rounded-2xl bg-[#F8F4FC]">
      <p className="font-semibold">Estamos analizando la imagen y fuentes de mercado.</p>
      <p className="text-sm text-[#7D718A] mt-2">Puedes mantener abierta esta pantalla. La consulta recupera el mismo proyecto; no inicia nuevas investigaciones ni videos.</p>
    </div>}
    {project.status==='failed'&&<p className="text-sm text-[#9A6257]">La investigación no pudo completarse. No se ha cobrado al cliente. Puedes utilizar el modo automático sin costo adicional.</p>}
    {project.status==='needs_review'&&!ready&&<p className="text-sm text-[#9A6257]">La investigación necesita revisión técnica antes de volver a intentarse. No se volverá a cobrar automáticamente.</p>}
    {ready&&<>
      <p className="text-sm font-semibold text-[#6B4B8C] rounded-xl bg-[#F3EBFA] p-3">Configuración investigada: {project.video_model_id} · {project.video_duration_seconds||8} segundos · {creativeStyles.find(([id])=>id===(project.creative_style||'auto'))?.[2]||'Automático'}. No se vuelve a consultar la IA al elegir concepto.</p>

      {project.owner_cost_audit&&<div className="rounded-xl border border-[#C9DAE5] bg-[#F1F7FD] p-4 text-xs text-[#496079] space-y-1">
       <p className="font-bold">Auditoría privada · costo de OpenAI</p>
       <p>{project.owner_cost_audit.cost_status==='estimated'&&Number.isInteger(project.owner_cost_audit.estimated_cost_micro_usd)?
         'Estimación por esta investigación: USD '+(project.owner_cost_audit.estimated_cost_micro_usd/1_000_000).toFixed(6):
         'Costo de proveedor no calculable con las tarifas disponibles.'}</p>
       <p>{project.owner_cost_audit.input_tokens} tokens de entrada · {project.owner_cost_audit.output_tokens} de salida · {project.owner_cost_audit.web_calls} búsquedas.</p>
       <p>Importe orientativo, NO factura final. Contrastar con el reporte de costos de OpenAI. El precio cobrado al cliente sigue siendo USD 0,49.</p>
      </div>}
      <div className="rounded-2xl bg-[#F8F5F0] p-4 space-y-2">
       <p className="font-bold">Análisis comercial</p>
       <p className="text-sm text-[#6B5878]">
        {String(findings.market_summary||'').slice(0,200)}{String(findings.market_summary||'').length>200?'…':''}
       </p>
       <details className="text-xs text-[#796A83]">
        <summary className="font-semibold cursor-pointer">Ver informe completo, verificaciones y fuentes</summary>
        <div className="mt-3 space-y-2">
         <p>{findings.product_observation}</p><p>{findings.market_summary}</p>
         {(findings.description_conflicts||[]).length>0&&<p><strong>Observaciones:</strong> {findings.description_conflicts.join(' · ')}</p>}
         {(findings.claims_to_verify||[]).length>0&&<p><strong>Por verificar:</strong> {findings.claims_to_verify.join(' · ')}</p>}
         {(findings.research_limitations||[]).length>0&&<p><strong>Alcance:</strong> {findings.research_limitations.join(' · ')}</p>}
         <p>{project.sources?.length?project.sources.map((x,i)=><span key={i}>
          <a href={x.url} target="_blank" rel="noreferrer" className="underline text-[#6D48CB]">{x.title||x.url}</a>{' · '}
         </span>):'No se obtuvieron enlaces verificables.'}</p>
        </div>
       </details>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
       {concepts.map((c,i)=>{
        const visual=visualFor(c);
        return <button type="button" key={i} aria-pressed={selection===i}
          onClick={()=>setSelection(i)}
          className={'rounded-2xl text-left border-2 overflow-hidden transition '+(selection===i?'border-[#8054C9] shadow-md':'border-[#E9DFEC] hover:border-[#B89DE4]')}>
         <div className="h-[110px] bg-gradient-to-br from-[#E6DBF6] via-[#F8E8EA] to-[#F9EDD7] flex items-center justify-center gap-4 relative">
          {image?.url?<img src={image.url} alt="" className="h-20 w-20 rounded-xl object-contain bg-white/65 p-1 shadow-sm"/>:
           <span className="text-5xl" aria-hidden="true">{visual.icon}</span>}
          <div className="rounded-full bg-white/85 w-12 h-12 flex items-center justify-center text-2xl" aria-hidden="true">{visual.icon}</div>
          <span className="absolute top-2 right-2 bg-white/90 rounded-full px-2 py-1 text-[10px] font-bold text-[#70509E]">{visual.label}</span>
         </div>
         <div className="p-4 space-y-2">
          <p className="font-bold text-sm">{c.name}</p>
          <p className="text-xs text-[#7D698A] line-clamp-2">“{c.hook}”</p>
          <p className="text-xs font-bold text-[#7551BD]">{selection===i?'✓ Elegido':'Elegir concepto'}</p>
         </div>
        </button>;
       })}
      </div>
      {concepts[selection]&&<div className="space-y-3">

        <div className="rounded-xl bg-[#F8F3FC] p-4">
         <p className="text-xs font-bold text-[#7555A5]">Guion hablado · {languages.find(([code])=>code===(project.video_language||'es'))?.[1]||'Español'}</p>
         <textarea value={editedSpeech} onChange={e=>setEditedSpeech(e.target.value)}
          aria-label="Editar guion hablado sin costo adicional"
          className={field+' mt-2 min-h-[95px] text-sm'} maxLength={650}/>
         <p className="text-xs text-[#816D8F] mt-1">Edita el gancho, la explicación y el cierre sin pagar otra investigación. {style==='ugc'?
           spokenWords+' palabras · objetivo '+speechMin+'–'+speechMax+' para '+durationSpeech+' s.':
           'El guion debe caber en '+durationSpeech+' segundos.'}</p>
         <details className="mt-3 text-xs text-[#7A6988]">
          <summary className="cursor-pointer">Mostrar los planos</summary>
          <ul className="list-disc pl-4 mt-2 space-y-1">
           {(concepts[selection].shots||[]).map((shot,i)=><li key={i}>{shot}</li>)}
          </ul>
         </details>
        </div>
        <div className="space-y-2">
         <p className="text-sm font-bold">¿Cómo quieres que se vea el anuncio?</p>
         {project.creative_style==='auto'
          ?<div className="space-y-2">
            <p className="text-xs text-[#7E658B]">Proyecto anterior o estilo automático: puedes ajustar la presentación sin nueva consulta IA. Revisa y edita el guion hablado.</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
             {creativeStyles.map(([id,icon,label])=><button type="button" key={id}
              aria-pressed={style===id} onClick={()=>setStyle(id)}
              className={'rounded-xl border-2 px-2 py-3 text-center '+(style===id
               ?'border-[#7650C6] bg-[#F2EAFE]':'border-[#E7DEEC] bg-white')}>
              <span className="block text-xl" aria-hidden="true">{icon}</span>
              <span className="block mt-1 text-xs font-bold">{label}</span>
             </button>)}
            </div>
           </div>
          :<p className="text-sm font-semibold rounded-xl bg-[#F4EBFB] px-4 py-3">
            {creativeStyles.find(([id])=>id===style)?.[2]||'Automático'} · elegido antes de investigar.
            {style==='ugc'?' La voz es lo principal; los planos son apoyo.':''}
           </p>}
         <label className="block text-xs font-bold">Tomas
          <select className={field+' mt-2'} value={shotPreference} onChange={e=>setShotPreference(e.target.value)}>
           <option value="auto">La IA decide</option>
           <option value="single">Una toma</option>
           <option value="multi">Varias tomas</option>
          </select>
         </label>
        </div>
        <p className="text-xs text-[#6B5387]">El director audiovisual adapta voz, planos y referencias al modelo que elijas.</p>

        <details className="rounded-xl border border-[#E7DCEF] p-4">
         <summary className="cursor-pointer text-sm font-bold">Editar prompt técnico (avanzado)</summary>
         <p className="text-xs text-[#7C6C88] mt-2">El motor puede recibir instrucciones técnicas en inglés; el guion hablado se solicita en el idioma elegido. La voz nativa depende del modelo de video seleccionado.</p>
         <textarea value={editedPrompt} onChange={e=>setEditedPrompt(e.target.value)}
           className={field+' mt-3 min-h-[155px]'} maxLength={5500}/>
        </details>
      </div>}
      <label className="flex items-start gap-3 rounded-xl bg-[#F8F3FC] p-4 text-sm">
       <input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)} className="mt-1"/>
       <span>Confirmo que soy responsable de las afirmaciones comerciales de mi anuncio y he revisado las observaciones. Realizo corregirá erratas sin cambiar la intención del producto.</span>
      </label>
      <button type="button" onClick={approve}
       disabled={busy||(style==='ugc'&&(spokenWords<speechMin||spokenWords>speechMax))}
        className="rounded-2xl bg-[#6D48CB] text-white font-bold py-3.5 px-6 disabled:opacity-50">
        {busy?'Guardando…':'Aprobar concepto y elegir modelo de video'}
      </button>
      <p className="text-xs text-[#86788F]">La aprobación no genera ni cobra un video. El editor mostrará su precio antes del envío.</p>
    </>}
  </section>}
 </div>;
}
