'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {optimizeImage} from '@/lib/realizo-creative/optimize-image';
import styles from './RealizoHyperrealPro.module.css';

const DEFAULT={
 source_mode:'ai',product_name:'',description:'',audience:'',angle:'',cta:'',
 creative_style:'ugc',audio_mode:'camera',cast_mode:'auto',duration:30,
 aspect_ratio:'9:16',market_code:'EC',actor:'',location:'',instructions:''
};
const ERRORS={
 product_photo_required:'Para conservar el envase real necesitamos una foto del producto.',
 document_details_required:'Completa primero la ficha con tu documento o escribe el nombre y la descripción.',
 invalid_media_reference:'La referencia caducó. Vuelve a seleccionar la foto.',
 hyperreal_quote_provider_unavailable:'MuAPI no pudo confirmar todos los precios. No se cobró nada.',
 hyperreal_engine_not_verified:'La cadena automática de imágenes, videos y montaje aún está en validación. No hay cargos.',
 hyperreal_pilot_owner_only:'Esta primera fase está habilitada solo para la cuenta de pruebas del propietario. No se realizó ningún cobro.',
 hyperreal_quote_expired:'La cotización caducó. Vuelve a cotizar antes de pagar.',
 insufficient_wallet_credits:'No tienes créditos suficientes para el paquete.',
 hyperreal_active_job_limit:'Espera a terminar alguno de tus tres proyectos activos.',
 document_ai_unavailable:'No se pudo analizar el documento. Intenta más tarde.',
 document_ai_not_configured:'La lectura documental no está disponible en este momento.',
 document_daily_limit:'Llegaste al límite de tres documentos al día.',
 document_result_invalid:'No se pudo extraer una ficha válida.',
 unsupported_document:'Admite PDF de 4 MB, DOCX de 2 MB o TXT de 200 KB.',
 hyperreal_billing_not_ready:'El cobro premium no está habilitado.',
 hyperreal_provider_not_ready:'El servicio de IA no está listo.'
};
const money=c=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((c||0)/100);
const control={display:'block',marginTop:8};
const small='text-[#CEC0DC] text-[12px] leading-5';
const STYLES=[['ugc','UGC natural','Persona real hablando a cámara'],
 ['premium','Premium','Detalles, emoción y valor'],
 ['demo','Demostración','Producto en acción'],
 ['cinematic','Cinematográfico','Historia comercial con continuidad']];
const STATUS={
 quoted:'Cotización pendiente',reserved:'En cola',processing:'Produciendo',
 needs_review:'Revisión técnica',completed:'Video listo',failed:'No se pudo completar'
};
const STAGE={
 quote:'Presupuesto',research:'Investigando producto y guion',
 image_master:'Creando protagonista hiperrealista',
 scene_images:'Generando fotografías de cada escena',
 scene_videos:'Animando cada toma con Kling',
 montage:'Montando y revisando el anuncio',
 completed:'Video final listo',failed:'Producción interrumpida',
 needs_review:'Conciliación del proveedor'
};
export default function RealizoHyperrealPro({guest=false,onWalletRefresh}){
 const [form,setForm]=useState(DEFAULT);
 const [photo,setPhoto]=useState(null),[preview,setPreview]=useState('');
 const [document,setDocument]=useState(null);
 const [docResult,setDocResult]=useState(null),[docJob,setDocJob]=useState(''),
       [docStatus,setDocStatus]=useState(''),[docBusy,setDocBusy]=useState(false);
 const [modelsOpen,setModelsOpen]=useState(false);
 const [quote,setQuote]=useState(null),[jobId,setJobId]=useState('');
 const [jobs,setJobs]=useState([]),[busy,setBusy]=useState(false);
 const [progress,setProgress]=useState(''),[error,setError]=useState('');
 const cachedAsset=useRef({file:null,url:''});
 const update=(key,value)=>{
  setForm(p=>({...p,[key]:value}));
  setQuote(null);setError('');
 };
 const fail=e=>ERRORS[e]||String(e||'Ocurrió un error. Intenta nuevamente.');
 async function reload(){
  try{
   const r=await fetch('/api/realizo/hyperreal/prepare?list=1',{credentials:'same-origin',cache:'no-store'});
   if(r.ok){const j=await r.json();setJobs(j.jobs||[]);}
  }catch{}
 }
 useEffect(()=>{
  if(guest)return;
  reload();
  fetch('/api/realizo/hyperreal/document',{credentials:'same-origin',cache:'no-store'})
   .then(r=>r.ok?r.json():null).then(j=>{
    if(!j?.job_id)return;
    if(j.status==='completed'){setDocResult(j.result);setDocStatus('completed');}
    else if(['starting','submitted'].includes(j.status)){
     setDocJob(j.job_id);setDocStatus(j.status);
    }
   }).catch(()=>{});
 },[guest]);
 useEffect(()=>{
  if(!photo){setPreview('');return;}
  const url=URL.createObjectURL(photo);setPreview(url);
  return ()=>URL.revokeObjectURL(url);
 },[photo]);
 useEffect(()=>{
  if(!docJob||!['starting','submitted'].includes(docStatus))return;
  let cancelled=false,timer;
  const poll=async()=>{
   try{
    const r=await fetch('/api/realizo/hyperreal/document?job_id='+docJob,
       {credentials:'same-origin',cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(cancelled)return;
    if(!r.ok)throw Error(j.error);
    if(j.status==='completed'){
     setDocStatus('completed');setDocBusy(false);setDocResult(j.result);
     setForm(p=>({...p,product_name:j.result.product_name||p.product_name,
      description:j.result.description||p.description,
      audience:j.result.audience||p.audience,angle:j.result.angle||p.angle}));
    }else if(j.status==='failed'){
     setDocBusy(false);setDocStatus('failed');setError(fail(j.error));
    }else{setDocStatus(j.status);timer=setTimeout(poll,3500);}
   }catch{if(!cancelled)timer=setTimeout(poll,5000);}
  };
  timer=setTimeout(poll,3000);
  return ()=>{cancelled=true;clearTimeout(timer);};
 },[docJob,docStatus]);
 useEffect(()=>{
  if(!jobId)return;
  let disposed=false,timer;
  const poll=async()=>{
   try{
    const r=await fetch('/api/realizo/hyperreal/prepare?job_id='+jobId,
      {credentials:'same-origin',cache:'no-store'});
    if(r.ok){
     const j=await r.json();
     if(disposed)return;
     setJobs(list=>[j.job,...list.filter(x=>x.id!==j.job.id)].slice(0,12));
     if(['completed','failed','needs_review'].includes(j.job.status)){
      setJobId('');onWalletRefresh?.();return;
     }
    }
   }catch{}
   if(!disposed)timer=setTimeout(poll,9000);
  };
  timer=setTimeout(poll,1800);
  return ()=>{disposed=true;clearTimeout(timer);};
 },[jobId]);
 const selectPhoto=e=>{
  const file=e.target.files?.[0]||null;
  if(file&&(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)){
   setError('Elige una imagen JPG, PNG o WebP de hasta 8 MB.');return;
  }
  setPhoto(file);cachedAsset.current={file:null,url:''};setQuote(null);setError('');
 };
 const analyzeDocument=async()=>{
  if(guest){location.assign('/login');return;}
  if(!document||docBusy)return;
  setError('');setDocBusy(true);setDocResult(null);
  const f=new FormData();f.append('document',document,document.name);
  f.append('request_key',crypto.randomUUID());
  try{
   const r=await fetch('/api/realizo/hyperreal/document',{
    method:'POST',credentials:'same-origin',body:f
   });
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.job_id)throw Error(j.error||'document_ai_unavailable');
   setDocJob(j.job_id);setDocStatus(j.status);
  }catch(e){setDocBusy(false);setError(fail(e.message));}
 };
 const getPhotoUrl=async()=>{
  if(cachedAsset.current.file===photo&&cachedAsset.current.url)return cachedAsset.current.url;
  const optimized=await optimizeImage(photo);
  const f=new FormData();f.append('image',optimized,optimized.name||'referencia.jpg');
  const r=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body:f});
  const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.url)throw Error(j.error||'No se pudo subir la foto.');
  cachedAsset.current={file:photo,url:j.url};
  return j.url;
 };
 const getQuote=async()=>{
  if(guest){location.assign('/login');return;}
  if(!photo){setError(ERRORS.product_photo_required);return;}
  if(form.source_mode==='document'&&(!form.product_name||form.description.length<15)){
   setError(ERRORS.document_details_required);return;
  }
  if(busy)return;
  setBusy(true);setError('');setProgress('Preparando foto y consultando todos los costos...');
  try{
   const url=await getPhotoUrl();
   const r=await fetch('/api/realizo/hyperreal/prepare',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'quote',request_key:crypto.randomUUID(),
      brief:{...form,image_url:url}})
   });
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.quote_id)throw Error(j.error||'hyperreal_quote_provider_unavailable');
   setQuote(j);
  }catch(e){setError(fail(e.message));}
  finally{setBusy(false);setProgress('');}
 };
 const confirm=async()=>{
  if(!quote||busy)return;
  setBusy(true);setError('');setProgress('Confirmando presupuesto y reservando créditos...');
  try{
   const r=await fetch('/api/realizo/hyperreal/prepare',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'confirm',quote_id:quote.quote_id})
   });
   const j=await r.json().catch(()=>({}));
   if(!r.ok||!j.job_id)throw Error(j.error||'hyperreal_reservation_failed');
   setQuote(null);setJobId(j.job_id);onWalletRefresh?.();reload();
  }catch(e){setError(fail(e.message));}
  finally{setBusy(false);setProgress('');}
 };
 const currentJobs=useMemo(()=>jobs.slice(0,6),[jobs]);
 return <section className={styles.shell}>
  <header className="mb-6">
   <span className={styles.stat}>✦ Hiperrealista PRO · Producción automática</span>
   <h1 className="text-[29px] sm:text-[40px] font-extrabold text-[#FCF5FF] mt-3">Comerciales que parecen grabados de verdad.</h1>
   <p className={styles.muted}>Tú eliges el estilo. Realizo investiga, crea las fotografías 4K, anima las escenas y las une.</p>
  </header>
  <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-6">
   <div className="space-y-5">
    <section className={styles.panel+' p-5 sm:p-7 space-y-5'}>
     <h2 className="text-xl font-extrabold text-[#FBF4FF]">1. Sube tu producto</h2>
     <label>Foto real del producto
      <input style={control} type="file" accept="image/jpeg,image/png,image/webp"
       onChange={selectPhoto}/>
     </label>
     <div className={styles.softPanel+' p-4 space-y-3'}>
      <p className="font-bold text-[#FBF4FF] text-sm">¿Quién decide la estrategia?</p>
      <div className="grid sm:grid-cols-2 gap-2">
       {[['ai','✦ IA decide todo','Investiga el producto y crea el anuncio'],
         ['document','▤ Tengo información','Sube su ficha y extrae las características']].map(v=>
         <button key={v[0]} type="button"
          aria-pressed={form.source_mode===v[0]}
          className={(form.source_mode===v[0]?styles.primary:styles.secondary)+' text-left'}
          onClick={()=>update('source_mode',v[0])}>
          <strong className="block text-[13px]">{v[1]}</strong>
          <span className="block text-[11px] mt-1">{v[2]}</span>
         </button>)}
      </div>
      {form.source_mode==='document'&&<>
       <label>Documentación PDF, Word o TXT
        <input style={control} type="file"
         accept=".pdf,.docx,.txt,.md" onChange={e=>setDocument(e.target.files?.[0]||null)}/>
       </label>
       <button type="button" className={styles.secondary} onClick={analyzeDocument}
        disabled={!document||docBusy}>{docBusy?'Leyendo documentación…':'Extraer información con IA'}</button>
       {docResult&&<p className={styles.success+' text-xs'}>Ficha extraída. Puedes editar los campos si lo deseas.</p>}
       <label>Producto
        <input style={control} maxLength={90} value={form.product_name}
         onChange={e=>update('product_name',e.target.value)}/>
       </label>
       <label>Características confirmadas
        <textarea style={control} rows={3} maxLength={1200} value={form.description}
         onChange={e=>update('description',e.target.value)}/>
       </label>
      </>}
      {form.source_mode==='ai'&&<p className={small}>
       Realizo investigará a partir de la foto. Si la identidad no es clara, solicitará más datos
       en lugar de inventar características.</p>}
     </div>
    </section>
    <section className={styles.panel+' p-5 sm:p-7 space-y-5'}>
     <h2 className="text-xl font-extrabold text-[#FBF4FF]">2. ¿Cómo quieres el video?</h2>
     <div className="grid sm:grid-cols-2 gap-2">
      {STYLES.map(s=><button key={s[0]} type="button" aria-pressed={form.creative_style===s[0]}
       className={(form.creative_style===s[0]?styles.primary:styles.secondary)+' text-left'}
       onClick={()=>update('creative_style',s[0])}>
        <strong className="block text-[13px]">{s[1]}</strong>
        <span className="block text-[11px] mt-1">{s[2]}</span>
       </button>)}
     </div>
     <div className="grid sm:grid-cols-3 gap-3">
      <label>Duración
       <select style={control} value={form.duration} onChange={e=>update('duration',Number(e.target.value))}>
        {[15,30,45].map(n=><option key={n} value={n}>{n} segundos</option>)}
       </select>
      </label>
      <label>Formato
       <select style={control} value={form.aspect_ratio} onChange={e=>update('aspect_ratio',e.target.value)}>
        <option value="9:16">9:16 vertical</option><option value="16:9">16:9 horizontal</option>
       </select>
      </label>
      <label>Voz
       <select style={control} value={form.audio_mode} onChange={e=>update('audio_mode',e.target.value)}>
        <option value="camera">Habla a cámara</option>
        <option value="voiceover">Narración en off</option>
        <option value="none">Solo actividades</option>
       </select>
      </label>
     </div>
     <details className={styles.softPanel+' p-4'} open={modelsOpen}>
      <summary onClick={e=>{e.preventDefault();setModelsOpen(v=>!v)}}>
       Motor de video <span className="text-[#CDB7ED]">Kling 4.0</span> · Cambiar modelo
      </summary>
      {modelsOpen&&<div className="mt-3 space-y-2">
       <label>Modelo de animación
        <select style={control} value="kling" onChange={()=>{}}>
         <option value="kling">Kling 4.0 · activo</option>
         <option disabled>Seedance 2.5 · pendiente de verificar el montaje</option>
         <option disabled>Veo 3.1 · pendiente de verificar el montaje</option>
        </select>
       </label>
       <p className={small}>Nano Banana 2.1 Edit 4K prepara las imágenes automáticamente. Las opciones adicionales se habilitarán solo cuando su presupuesto y cadena por escenas estén probados.</p>
      </div>}
     </details>
     <details className={styles.softPanel+' p-4'}>
      <summary>Personalizar actor, público, ángulo y CTA (opcional)</summary>
      <div className="space-y-3 mt-4">
       <label>Público objetivo
        <input style={control} maxLength={180} value={form.audience} onChange={e=>update('audience',e.target.value)}/>
       </label>
       <label>Ángulo comercial
        <textarea style={control} rows={2} maxLength={350} value={form.angle}
         placeholder="Si queda vacío, la IA decide" onChange={e=>update('angle',e.target.value)}/>
       </label>
       <label>Persona y escenario
        <textarea style={control} rows={2} maxLength={220} value={form.actor}
         placeholder="Ej. Hombre adulto de 30 años, casa real, luz natural"
         onChange={e=>update('actor',e.target.value)}/>
       </label>
       <label>Llamado a la acción
        <input style={control} maxLength={120} value={form.cta}
         placeholder="Ej. Escríbenos para pedirlo" onChange={e=>update('cta',e.target.value)}/>
       </label>
      </div>
     </details>
     <button type="button" className={styles.primary+' w-full'} onClick={getQuote}
      disabled={!photo||busy}>{busy?'Consultando precios…':'Ver presupuesto completo'}</button>
     <p className={small}>Ver el presupuesto no cobra créditos. Ninguna imagen ni video se generará sin tu autorización.</p>
    </section>
   </div>
   <div className="space-y-5">
    <section className={styles.panel+' p-5 sm:p-7 space-y-4'}>
     <h2 className="text-xl font-extrabold text-[#FBF4FF]">Vista del producto</h2>
     <div className={styles.preview}>{preview?
      <img src={preview} alt="Fotografía real del producto"/>:
      <p className={styles.muted+' p-6 text-center'}>Sube tu foto para comenzar</p>}</div>
     <p className={styles.muted}>Identidad del envase y del personaje consistente a lo largo de todas las escenas.</p>
    </section>
    <section className={styles.panel+' p-5 sm:p-7 space-y-4'}>
     <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-extrabold text-[#FBF4FF]">Mis producciones PRO</h2>
      <button type="button" className={styles.secondary} onClick={reload}>Actualizar</button>
     </div>
     {!currentJobs.length?<p className={styles.muted}>Tus trabajos aparecerán aquí. Podrás cerrar la página y regresar a consultar su estado.</p>:
      currentJobs.map(j=><div className={styles.softPanel+' p-4 space-y-2'} key={j.id}>
       <div className="flex justify-between items-center gap-2">
        <strong className="text-[#F7EEFF] text-sm">{j.duration} s · {STATUS[j.status]||j.status}</strong>
        <span className={small}>{money(j.price_cents)}</span>
       </div>
       <p className={small}>{STAGE[j.stage]||j.stage}</p>
       {j.status==='processing'&&<p className={small}>
        Imágenes: {j.image_count}/{j.scene_count+1} · Clips: {j.video_count}/{j.scene_count}</p>}
       {j.has_video&&<a className="text-[#D7B7FF] underline text-sm font-bold"
        href={'/api/realizo/hyperreal/prepare?download='+j.id} target="_blank" rel="noopener noreferrer">
         Ver y descargar MP4 final
        </a>}
       {j.status==='failed'&&<p className={small}>La reserva se libera automáticamente cuando el fallo queda confirmado.</p>}
       {j.status==='needs_review'&&<p className={small}>El proveedor requiere conciliación antes de continuar. No se generará un cobro doble.</p>}
      </div>)}
    </section>
    {progress&&<p role="status" className={styles.muted}>{progress}</p>}
    {error&&<div role="alert" className={styles.error}>{error}</div>}
   </div>
  </div>
  {quote&&<div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
   <div className="w-full max-w-[475px] rounded-[24px] border border-[#6A527D] bg-[#191621] p-6 text-[#FDF6FF] shadow-2xl space-y-4">
    <h3 className="text-[22px] font-extrabold">Producción Hiperrealista PRO</h3>
    <p className="text-[#CFC2DC] text-[13px]">Un solo presupuesto para todo el anuncio. No es solo Kling.</p>
    <div className="space-y-2 text-[13px]">
     {[['Investigación y dirección comercial',quote.quote.director_and_research_cents],
       ['Fotografías hiperrealistas 4K ('+quote.quote.image_count+')',quote.quote.image_cents],
       ['Animaciones de escenas ('+quote.quote.scene_count+')',quote.quote.video_cents],
       ['Montaje y revisión',quote.quote.montage_and_quality_cents],
       ['Servicio Realizo',quote.quote.service_margin_cents]].map(v=>
      <div className="flex justify-between gap-3" key={v[0]}>
       <span>{v[0]}</span><strong>{money(v[1])}</strong>
      </div>)}
     <div className="flex justify-between border-t border-[#655270] pt-3 font-bold text-[17px]">
      <span>Precio máximo autorizado</span><span>{money(quote.quote.total_cents)}</span>
     </div>
     <p className={small}>Saldo: {money(quote.available_cents)}. Nada se descuenta si cancelas.</p>
    </div>
    <div className="flex gap-2">
     <button type="button" className={styles.primary+' flex-1'} disabled={busy||!quote.affordable}
      onClick={confirm}>Confirmar todo el paquete</button>
     <button type="button" className={styles.secondary} disabled={busy} onClick={()=>setQuote(null)}>Cancelar</button>
    </div>
    {!quote.affordable&&<p className={styles.error}>Saldo insuficiente para este presupuesto.</p>}
   </div>
  </div>}
 </section>;
}
