'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {extractGeneratedVideoUrl} from '@/lib/realizo-creative/wallet-generation';

const MODEL_ID='seedance-2-omni-reference';
const QUESTIONS=[
  {title:'Muéstrame tu producto',hint:'Empezamos con una fotografía real. Se usará como referencia, no como primer fotograma.'},
  {title:'¿Qué vamos a anunciar?',hint:'Cuéntame lo importante. El video respetará los datos que proporciones.'},
  {title:'¿Qué estilo quieres?',hint:'Elige la manera de contar la historia. Cada estilo mantiene la identidad de tu producto.'},
  {title:'¿A quién queremos llegar?',hint:'Adaptaremos la historia al público y al país que elijas.'},
  {title:'¿Cómo quieres verlo?',hint:'Define el formato del anuncio. Solo aparecen opciones compatibles con Seedance 2.0.'},
  {title:'¿Qué debe decir el video?',hint:'Elige la acción final y añade indicaciones si quieres personalizar más.'},
  {title:'Todo preparado',hint:'Revisa la propuesta y el precio real antes de autorizar el cargo.'}
];
const STYLES=[
  {id:'auto',icon:'✦',name:'IA decide',detail:'Un anuncio pensado para tu producto'},
  {id:'ugc',icon:'◉',name:'UGC natural',detail:'Persona realista hablando a cámara'},
  {id:'demo',icon:'▣',name:'Demostración',detail:'El producto en uso, sin rodeos'},
  {id:'premium',icon:'✧',name:'Premium',detail:'Comercial aspiracional con personas'},
  {id:'cine',icon:'▤',name:'Cinematográfico',detail:'Historia visual cuidada'},
  {id:'pov',icon:'◎',name:'POV',detail:'Una experiencia desde primera persona'}
];
const OBJECTIVES=[
  {id:'sales',name:'Generar ventas',detail:'Anuncio con invitación a comprar'},
  {id:'messages',name:'Recibir mensajes',detail:'Enfoque en conversaciones de WhatsApp'},
  {id:'awareness',name:'Presentar el producto',detail:'Mostrar características y uso'}
];
const INPUT='w-full rounded-2xl border border-[#e6dce9] bg-white px-4 py-3.5 text-[#2b1e3c] outline-none focus:border-[#8866d8] focus:ring-2 focus:ring-[#d8c7f6]';
const CARD='rounded-[26px] border border-[#e9dfea] bg-white shadow-[0_12px_35px_rgba(50,30,76,.045)]';
const usd=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((value||0)/100);
const INITIAL={name:'',description:'',style:'auto',audience:'',market:'Ecuador',objective:'sales',
  ratio:'9:16',duration:8,resolution:'720p',quality:'high',cta:'Escríbenos por WhatsApp',notes:''};

function scriptFor(d){
  const name=d.name.trim();
  const cta=d.cta.trim()||'Pide más información';
  const identity='@image1 es la referencia OBLIGATORIA de identidad del producto '+name+'. Conserva estrictamente marca, tipografía, etiqueta, tapa, envase, proporciones y colores originales en todas las tomas. La referencia NO es un fotograma inicial: empieza una filmación nueva en un escenario real.';
  const context='Mercado: '+d.market+'. Público: '+(d.audience.trim()||'personas interesadas en el producto')+'. Objetivo: '+(OBJECTIVES.find(x=>x.id===d.objective)?.name||'Generar ventas')+'.';
  const facts='Producto: '+name+'. Información verificada por el vendedor: '+(d.description.trim()||'sin características adicionales confirmadas')+'. No inventes ingredientes, eficacia, testimonios, precios, descuentos, disponibilidad ni resultados.';
  const common='Filmación hiperrealista con física, piel, manos y materiales naturales. Un solo anuncio continuo con luz, vestuario, reparto, espacios, escala del producto y sonido coherentes entre cortes. Hook visual inmediato, producto visible temprano, demostración o detalle observable, beneficio fundamentado y cierre claro. Sin animar el envase flotando, rotaciones CGI, etiquetas deformadas, escenas decorativas repetidas ni letras inventadas. Composición legible para anuncio móvil.';
  const style=(d.style==='ugc'||d.style==='auto')
    ?'UGC creíble: adulto natural mirando y hablando directamente a cámara desde el primer segundo. Sonido y labios sincronizados, español latinoamericano conversacional, 1 o 2 acciones reales y producto en mano. Alterna rostro y detalle manteniendo al mismo personaje. Nada de falso testimonio real ni voz de locutor exagerada.'
    :d.style==='demo'
    ?'Demostración: muestra el producto funcionando de forma físicamente plausible en un contexto cotidiano, con planos útiles, manos naturales y continuidad de la misma acción. Narración breve en español si ayuda.'
    :d.style==='cine'
    ?'Cine comercial: microhistoria visual en un único entorno coherente, cámara física, movimiento natural y montaje con intención. No es un avatar hablando a cámara. Música ambiente y voz solo si ayudan al objetivo.'
    :d.style==='premium'
    ?'Comercial premium aspiracional: persona adulta usando o mostrando el producto, iluminación elegante pero real, identidad humana estable, detalle del producto y cierre memorable; no una animación de botella.'
    :'POV cámara en primera persona: manos interactuando con el producto, uso verificable y ambiente real, sin un personaje hablando frente a cámara.';
  const extras=Array.from({length:8},(_,i)=>i+2).filter(i=>i<=d.imageCount)
    .map(i=>'@image'+i+' es referencia adicional de apariencia o escenario; úsala sin sustituir la identidad de @image1.').join(' ');
  const audio='Si hay voz, habla español latinoamericano, con frases breves adecuadas para '+d.duration+' segundos. CTA: '+cta+'.';
  return [identity,extras,context,facts,style,common,audio,d.notes.trim()?'Instrucciones adicionales del cliente: '+d.notes.trim():null].filter(Boolean).join('\n').slice(0,3900);
}
function Option({chosen,onClick,title,detail,icon}){
 return <button type="button" onClick={onClick} aria-pressed={chosen}
   className={'group rounded-[20px] border px-4 py-4 text-left transition flex gap-3 items-start min-h-[91px] '+
     (chosen?'border-[#8657d6] bg-[#f3ebff] shadow-[0_5px_17px_rgba(116,77,187,.1)]':'border-[#e6dfeb] bg-white hover:border-[#c2a6ec] hover:bg-[#fcfaff]')}>
   <span className={'h-10 w-10 shrink-0 rounded-xl grid place-items-center text-xl '+(chosen?'bg-[#7a50ce] text-white':'bg-[#f1eaf7] text-[#7655ae]')}>{icon||'✦'}</span>
   <span className="min-w-0"><strong className="block text-sm text-[#342345]">{title}</strong><small className="block mt-1 text-[12px] leading-5 text-[#85758d]">{detail}</small></span>
   {chosen&&<span className="ml-auto text-[#7951c7] font-extrabold">✓</span>}
 </button>;
}

export default function RealizoSeedanceFlow({accountId,initialStyle='auto',initialNotes='',uploadAsset,onWalletRefresh,onViewVideos}){
 const [d,setD]=useState({...INITIAL,style:STYLES.some(x=>x.id===initialStyle)?initialStyle:'auto',notes:initialNotes.slice(0,450)});
 const [step,setStep]=useState(0);
 const [photos,setPhotos]=useState([]);
 const [uploading,setUploading]=useState(false);
 const [uploadError,setUploadError]=useState('');
 const [quote,setQuote]=useState(null);
 const [quoteError,setQuoteError]=useState('');
 const [quoting,setQuoting]=useState(false);
 const [sending,setSending]=useState(false);
 const [jobId,setJobId]=useState('');
 const [jobStatus,setJobStatus]=useState('');
 const [providerPercent,setProviderPercent]=useState(null);
 const [videoUrl,setVideoUrl]=useState('');
 const [jobError,setJobError]=useState('');
 const [pollError,setPollError]=useState('');
 const fileInput=useRef(null);
 const keyRef=useRef(null);
 const doneRef=useRef(onWalletRefresh);
 useEffect(()=>{doneRef.current=onWalletRefresh},[onWalletRefresh]);

 const change=(field,value)=>{setD(old=>({...old,[field]:value}));setQuote(null);setQuoteError('');};
 const data=useMemo(()=>({...d,imageCount:photos.length}),[d,photos.length]);
 const prompt=useMemo(()=>scriptFor(data),[data]);
 const input=useMemo(()=>({prompt,images_list:photos.map(p=>p.url),aspect_ratio:d.ratio,
   duration:Number(d.duration),resolution:d.resolution,quality:d.quality}),[prompt,photos,d.ratio,d.duration,d.resolution,d.quality]);
 const signature=JSON.stringify(input);
 const preview=photos[0]?.url;
 const savedJobKey='realizo:seedance2:active:'+accountId;

 useEffect(()=>{
   try{
     const id=sessionStorage.getItem(savedJobKey);
     if(id && /^[a-f0-9-]{30,70}$/i.test(id)){setJobId(id);setStep(7);}
   }catch{}
 },[savedJobKey]);

 async function addPhotos(files){
   if(!files?.length||uploading)return;
   const available=9-photos.length;
   if(available<=0){setUploadError('Puedes subir hasta nueve imágenes.');return;}
   setUploadError('');setUploading(true);
   try{
     for(const file of Array.from(files).slice(0,available)){
       if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)
         throw Error('Cada imagen debe ser JPG, PNG o WebP de máximo 8 MB.');
       const url=await uploadAsset(file);
       if(!url)throw Error('No se recibió una referencia válida.');
       setPhotos(current=>[...current,{url,name:file.name,id:crypto.randomUUID()}].slice(0,9));
     }
   }catch(error){setUploadError(error.message||'No pudimos cargar las referencias.');}
   finally{setUploading(false);}
 }
 function next(){
   if(step===0 && !photos.length){setUploadError('Sube al menos una imagen de referencia para comenzar.');return;}
   if(step===1 && !d.name.trim()){setUploadError('Escribe el nombre del producto para continuar.');return;}
   setUploadError('');setStep(old=>Math.min(6,old+1));
 }
 function back(){setUploadError('');setStep(old=>Math.max(0,old-1));}

 useEffect(()=>{
   if(step!==6||!photos.length||!d.name.trim())return;
   const controller=new AbortController();
   setQuote(null);setQuoteError('');setQuoting(true);
   fetch('/api/wallet/quote',{method:'POST',credentials:'same-origin',
     headers:{'Content-Type':'application/json'},
     body:JSON.stringify({model_id:MODEL_ID,input}),signal:controller.signal})
     .then(async response=>{
       const body=await response.json().catch(()=>({}));
       if(!response.ok)throw Error(({
         invalid_media_reference:'Tus imágenes caducaron. Vuelve a cargarlas.',
         unsupported_model:'Seedance 2.0 no está disponible actualmente.',
         muapi_generation_route_not_found:'La ruta de Seedance 2.0 no está disponible en MuAPI.',
         muapi_generation_route_unverifiable:'No se pudo verificar la conexión con Seedance 2.0.',
         model_pricing_unavailable:'MuAPI no respondió con una cotización válida.',
         provider_price_inputs_invalid:'Estos ajustes no son compatibles con Seedance 2.0.'
       })[body.error]||'No se pudo confirmar el precio. No se realizó ningún cobro.');
       return body;
     }).then(body=>{if(!controller.signal.aborted)setQuote({...body,signature});})
     .catch(error=>{if(!controller.signal.aborted)setQuoteError(error.message||'No se pudo cotizar.');})
     .finally(()=>{if(!controller.signal.aborted)setQuoting(false)});
   return ()=>controller.abort();
 },[step,signature]);

 async function startGeneration(){
   if(sending||!quote||quote.signature!==signature||!quote.affordable)return;
   setSending(true);setJobError('');setPollError('');
   if(!keyRef.current)keyRef.current=crypto.randomUUID();
   try{
     const response=await fetch('/api/wallet/generate',{
       method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({model_id:MODEL_ID,input,max_price_cents:quote.price_cents,idempotency_key:keyRef.current})
     });
     const body=await response.json().catch(()=>({}));
     if(!response.ok){
       if(body.error==='price_changed_confirm_again'){setQuote(null);setStep(5);keyRef.current=null;throw Error('El precio cambió. Revisa una nueva cotización antes de generar.');}
       if(body.error==='insufficient_funds')throw Error('Tu saldo es insuficiente. Recarga antes de generar.');
       if(body.error==='generation_model_unavailable')throw Error('Seedance 2.0 no respondió. Revisa Mis videos y créditos antes de repetir.');
       throw Error('No se inició la generación ('+String(body.error||'error')+'). Revisa Mis videos y créditos.');
     }
     if(!body.job_id)throw Error('La solicitud no devolvió un identificador. Revisa Mis videos.');
     setJobId(body.job_id);setJobStatus(body.status||'reserved');setStep(7);
     try{sessionStorage.setItem(savedJobKey,body.job_id);}catch{}
     doneRef.current?.();
   }catch(error){setJobError(error.message||'No se pudo enviar el video.');}
   finally{setSending(false);}
 }
 useEffect(()=>{
   if(!jobId||videoUrl||jobError)return;
   let stopped=false;let timer;
   const poll=async()=>{
     try{
       const response=await fetch('/api/wallet/jobs/'+encodeURIComponent(jobId),{credentials:'same-origin',cache:'no-store'});
       const body=await response.json().catch(()=>({}));
       if(stopped)return;
       if(!response.ok && response.status!==202)throw Error('No fue posible consultar el trabajo.');
       if(body.polling_error){setPollError('Consultando el estado de MuAPI…');}
       else {
         setPollError('');
         setJobStatus(body.status||'sent');
         setProviderPercent(Number.isInteger(body.provider_progress_percent)?body.provider_progress_percent:null);
         if(body.status==='completed'){
           const url=extractGeneratedVideoUrl(body);
           if(url)setVideoUrl(url);
           else setJobError('El trabajo terminó, pero no se recibió el enlace. Revísalo en Mis videos.');
           try{sessionStorage.removeItem(savedJobKey);}catch{}
           doneRef.current?.();
           return;
         }
         if(body.status==='failed'){
           setJobError(body.release_confirmed===true
             ?'La generación falló. Los créditos reservados fueron liberados.'
             :'La generación falló. Revisa el estado de tus créditos antes de reintentar.');
           try{sessionStorage.removeItem(savedJobKey);}catch{}
           doneRef.current?.();return;
         }
         if(body.status==='unknown'){
           setJobError('El proveedor aún no confirmó el estado. No repitas el cargo; consulta Mis videos.');
           return;
         }
       }
     }catch{if(!stopped)setPollError('Seguimos comprobando la generación. Puedes volver a Mis videos.');}
     if(!stopped)timer=setTimeout(poll,3500);
   };
   poll();
   return ()=>{stopped=true;clearTimeout(timer);};
 },[jobId,videoUrl,jobError,savedJobKey]);

 function restart(){
   setPhotos([]);setD({...INITIAL,style:STYLES.some(x=>x.id===initialStyle)?initialStyle:'auto',notes:initialNotes.slice(0,450)});
   setQuote(null);setQuoteError('');setJobId('');setJobStatus('');setVideoUrl('');
   setJobError('');setPollError('');setProviderPercent(null);setStep(0);keyRef.current=null;
   try{sessionStorage.removeItem(savedJobKey);}catch{}
 }
 const percentage=Math.round(step/6*100);
 const styleName=STYLES.find(s=>s.id===d.style)?.name||'IA decide';
 return <div className="mx-auto max-w-[1070px] pb-14 text-[#2d2141]">
   <div className="rounded-[30px] border border-[#e9dfea] bg-gradient-to-r from-white to-[#f5effc] px-6 py-5 sm:px-8 mb-6 flex flex-wrap items-center justify-between gap-3">
     <div><p className="text-[10px] tracking-[.22em] font-extrabold uppercase text-[#9369b5]">Realizo · creación guiada</p>
       <h1 className="mt-1 text-[25px] sm:text-[32px] font-extrabold tracking-tight">Tu idea cobra vida<span className="text-[#ee9289]">.</span></h1>
       <p className="text-[13px] text-[#786d82] mt-1">Un paso a la vez · Seedance 2.0 · imágenes de referencia</p></div>
     {step<7&&<span className="rounded-full border border-[#d9cbeb] bg-white px-4 py-2 text-[12px] font-bold text-[#7550a5]">Paso {step+1} de 7</span>}
   </div>
   {step<7&&<div className="mb-6">
     <div className="flex items-center justify-between text-[12px] text-[#7d698d] mb-2"><strong>Preparación del anuncio</strong><span>{percentage}%</span></div>
     <div className="w-full h-2.5 rounded-full bg-[#e9dfef] overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin="0" aria-valuemax="100" aria-label="Preparación">
       <div className="h-full rounded-full bg-gradient-to-r from-[#925add] to-[#e998a8] transition-all duration-500" style={{width:percentage+'%'}}/>
     </div>
   </div>}
   {step<7&&<section className={CARD+' px-5 py-7 sm:px-9 sm:py-9'}>
     <div className="mb-7"><p className="uppercase tracking-[.18em] text-[#986ab8] text-[10px] font-extrabold">Realizo te pregunta</p>
       <h2 className="mt-2 text-[25px] sm:text-[32px] font-extrabold tracking-tight">{QUESTIONS[step].title}</h2>
       <p className="mt-2 text-[13px] sm:text-sm text-[#82758c] leading-6">{QUESTIONS[step].hint}</p></div>

     {step===0&&<div className="space-y-5">
       <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
         onChange={e=>{addPhotos(e.target.files);e.target.value='';}}/>
       <button type="button" onClick={()=>fileInput.current?.click()} disabled={uploading||photos.length>=9}
         className="w-full min-h-[175px] rounded-[24px] border-2 border-dashed border-[#bba6dd] bg-[#faf7ff] hover:bg-[#f2eaff] disabled:opacity-60 px-5 py-8 transition text-center">
         <span className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-[#e7d9fb] text-[#8055be] grid place-items-center text-2xl">＋</span>
         <strong className="block text-sm">{uploading?'Subiendo imágenes…':photos.length?'Agregar más referencias':'Subir fotos de referencia'}</strong>
         <span className="block text-[12px] text-[#907e9d] mt-2">JPG, PNG, WebP · máximo 8 MB por imagen · {photos.length}/9</span>
       </button>
       {photos.length>0&&<div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
         {photos.map((p,i)=><div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden border border-[#e6d9ee] bg-[#f8f3fb]">
           <img src={p.url} className="h-full w-full object-contain" alt={i===0?'Foto principal del producto':'Referencia adicional '+i}/>
           <span className="absolute left-1 top-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-[#634398]">{i===0?'Producto':'Ref. '+(i+1)}</span>
           <button type="button" onClick={()=>{setPhotos(items=>items.filter(x=>x.id!==p.id));setQuote(null);}} aria-label="Quitar imagen"
             className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/95 text-[#b15771] font-bold">×</button>
         </div>)}
       </div>}
       <p className="text-[12px] text-[#84798d]">La primera imagen identifica el producto. Las demás pueden mostrar una persona, un lugar u otros ángulos del mismo envase.</p>
     </div>}
     {step===1&&<div className="space-y-5">
       <label className="block"><span className="text-[13px] font-bold block mb-2">Nombre del producto *</span>
         <input autoFocus className={INPUT} maxLength={120} placeholder="Ej. GODA para hombre" value={d.name} onChange={e=>change('name',e.target.value)}/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Qué hace y cómo se usa?</span>
         <textarea rows={4} className={INPUT+' resize-y'} maxLength={1300} placeholder="Describe beneficios y usos que puedas respaldar…" value={d.description} onChange={e=>change('description',e.target.value)}/></label>
       {preview&&<div className="flex items-center gap-3 rounded-2xl bg-[#faf7fb] p-3"><img src={preview} alt="" className="w-14 h-14 object-contain rounded-lg"/><span className="text-[12px] text-[#766682]">Tu producto se conservará visualmente en las tomas.</span></div>}
     </div>}
     {step===2&&<div className="grid sm:grid-cols-2 gap-3">
       {STYLES.map(s=><Option key={s.id} icon={s.icon} title={s.name} detail={s.detail} chosen={d.style===s.id}
         onClick={()=>{change('style',s.id);setStep(3);}}/>)}
     </div>}
     {step===3&&<div className="space-y-5">
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿A qué país va dirigido?</span>
         <input className={INPUT} maxLength={80} placeholder="Ecuador" value={d.market} onChange={e=>change('market',e.target.value)}/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Qué tipo de persona debería verlo?</span>
         <input className={INPUT} maxLength={200} placeholder="Ej. Hombres de 25 a 45 años que cuidan su imagen" value={d.audience} onChange={e=>change('audience',e.target.value)}/></label>
       <span className="text-[13px] font-bold block">¿Qué resultado buscas?</span>
       <div className="grid sm:grid-cols-3 gap-3">{OBJECTIVES.map(o=><Option key={o.id} title={o.name} detail={o.detail} chosen={d.objective===o.id} onClick={()=>{change('objective',o.id);setStep(4);}}/>)}</div>
     </div>}
     {step===4&&<div className="space-y-6">
       <fieldset><legend className="text-[13px] font-bold mb-3">Formato de pantalla</legend>
         <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{[
           ['9:16','Vertical · Reels','▯'],['1:1','Cuadrado','□'],['16:9','Horizontal','▭'],['3:4','Vertical alternativo','▯']
         ].map(([v,label,ico])=><Option key={v} icon={ico} chosen={d.ratio===v} title={v} detail={label} onClick={()=>change('ratio',v)}/>)}</div></fieldset>
       <fieldset><legend className="text-[13px] font-bold mb-3">Duración</legend>
         <div className="grid grid-cols-4 gap-2">{[5,8,10,15].map(n=><button type="button" key={n} onClick={()=>change('duration',n)}
           className={'rounded-2xl border py-3 text-sm font-bold '+(d.duration===n?'bg-[#7953ca] text-white border-[#7953ca]':'bg-white border-[#e6ddeb] text-[#736287]')}>{n} s</button>)}</div>
         <p className="text-[12px] text-[#8c7b98] mt-2">Seedance 2.0 genera hasta 15 segundos por solicitud. No se promete un video de 30 o 45 segundos en una sola generación.</p></fieldset>
       <fieldset><legend className="text-[13px] font-bold mb-3">Calidad de imagen</legend>
         <div className="grid sm:grid-cols-2 gap-3">{[['720p','720p · equilibrado'],['1080p','1080p · alta definición']].map(([v,label])=><Option key={v} title={label} detail={v==='1080p'?'Mayor resolución y costo':'Buena calidad con menor costo'} chosen={d.resolution===v} onClick={()=>change('resolution',v)}/>)}</div></fieldset>
       <fieldset><legend className="text-[13px] font-bold mb-3">Modo de calidad</legend>
         <div className="grid sm:grid-cols-2 gap-3">{[['high','Máxima calidad'],['basic','Más económico']].map(([v,label])=><Option key={v} title={label} detail={v==='high'?'Prioriza fidelidad y detalle':'Prioriza costo y rapidez'} chosen={d.quality===v} onClick={()=>change('quality',v)}/>)}</div></fieldset>
     </div>}
     {step===5&&<div className="space-y-5">
       <label className="block"><span className="text-[13px] font-bold block mb-2">Llamado a la acción</span>
         <input className={INPUT} maxLength={150} value={d.cta} onChange={e=>change('cta',e.target.value)} placeholder="Ej. Escríbenos por WhatsApp"/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Algo especial que quieras incluir? <span className="font-normal text-[#9a8fa3]">(opcional)</span></span>
         <textarea className={INPUT+' resize-y'} rows={4} maxLength={450} value={d.notes} onChange={e=>change('notes',e.target.value)}
           placeholder="Ej. Dos planos con la misma persona y el producto en mano…"/></label>
       <p className="text-[12px] text-[#87778c]">El sistema preparará un guion visual acorde con la duración, sin añadir datos comerciales que no proporcionaste.</p>
     </div>}
     {step===6&&<div className="space-y-5">
       <div className="grid sm:grid-cols-[145px_1fr] gap-5 bg-[#fbf8fd] border border-[#efe6f2] rounded-[22px] p-4">
         {preview&&<img src={preview} className="h-40 w-full rounded-2xl object-contain bg-white" alt="Producto seleccionado"/>}
         <div className="space-y-2"><strong className="text-lg">{d.name}</strong>
           <p className="text-[13px] text-[#81748a]">{styleName} · {d.duration}s · {d.ratio} · {d.resolution} · {d.quality==='high'?'Alta calidad':'Económico'}</p>
           <p className="text-[13px] text-[#81748a]">Dirigido a {d.market||'tu mercado'} · {OBJECTIVES.find(x=>x.id===d.objective)?.name}</p>
           <p className="text-[12px] text-[#977ca3]">{photos.length} {photos.length===1?'referencia visual':'referencias visuales'} · Seedance 2.0</p>
         </div>
       </div>
       <details className="rounded-2xl border border-[#e9deed] p-4 bg-white"><summary className="cursor-pointer text-[13px] font-bold text-[#7255a1]">Ver las instrucciones de tu video</summary>
         <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-[#675b73]">{prompt}</pre></details>
       <div className="rounded-2xl bg-[#f2ebfa] p-5">
         <p className="text-[12px] font-bold text-[#8461a7] mb-2">Cotización de generación</p>
         {quoting?<p role="status" className="font-bold animate-pulse">Consultando precio real…</p>:
           quote&&quote.signature===signature?<><p className="text-[29px] font-extrabold">{usd(quote.price_cents)}</p>
             <p className="mt-1 text-[12px] text-[#786a87]">Saldo disponible: {usd(quote.available_cents)}. El cargo se reserva solo al confirmar.</p>
             {!quote.affordable&&<Link href="/wallet" className="mt-3 inline-block underline font-bold text-[#784fbd]">Recargar créditos</Link>}</>:
           <p role="alert" className="text-[#a04956] text-sm">{quoteError||'Precio no disponible. No puedes generar hasta obtener una cotización.'}</p>}
       </div>
       {jobError&&<p role="alert" className="text-[13px] text-[#a14a58]">{jobError}</p>}
       <button type="button" onClick={startGeneration} disabled={sending||quoting||!quote?.affordable||quote.signature!==signature}
         className="w-full rounded-2xl bg-[#7750c7] text-white disabled:opacity-45 hover:bg-[#6841b8] px-6 py-4 font-extrabold text-sm transition">
         {sending?'Enviando solicitud…':'Confirmar '+(quote?.price_cents?usd(quote.price_cents):'')+' y generar video'}
       </button>
       <p className="text-center text-[11px] text-[#897d91]">Nunca se genera ni se cobra sin tu confirmación. Si el precio cambia, se pedirá una nueva aprobación.</p>
     </div>}
     {step<6&&uploadError&&<p className="mt-5 text-[13px] text-[#a64e60]" role="alert">{uploadError}</p>}
     {step<6&&<div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-[#eee5f0] pt-6">
       <button type="button" onClick={back} disabled={step===0||uploading}
         className="rounded-2xl border border-[#e6ddec] px-5 py-3 font-bold text-sm text-[#766486] disabled:opacity-35">← Atrás</button>
       <button type="button" onClick={next} disabled={uploading}
         className="rounded-2xl bg-[#7650c6] px-6 py-3 font-bold text-sm text-white hover:bg-[#653cb5] disabled:opacity-50">Continuar →</button>
     </div>}
     {step===6&&<button type="button" onClick={back} className="mt-4 text-[13px] font-bold underline text-[#7650a9]">← Cambiar configuración</button>}
   </section>}
   {step===7&&<section className={CARD+' p-6 sm:p-9 text-center'}>
     {videoUrl?<><div className="mx-auto rounded-full bg-[#e5f7ee] w-14 h-14 grid place-items-center text-[#3f9864] text-2xl">✓</div>
       <h2 className="mt-4 text-2xl font-extrabold">¡Tu video está listo!</h2>
       <p className="text-sm text-[#82768a] mt-2">Se guardó en tu biblioteca de creaciones.</p>
       <video src={videoUrl} controls playsInline data-realizo-owned-video="true" className="mx-auto mt-6 w-full max-w-[360px] max-h-[570px] rounded-2xl bg-black"/>
       <div className="flex flex-wrap justify-center gap-3 mt-6"><button type="button" onClick={onViewVideos} className="bg-[#7550c7] text-white rounded-2xl px-6 py-3 font-bold">Ir a Mis videos</button>
         <button type="button" onClick={restart} className="border border-[#dfd5e8] rounded-2xl px-6 py-3 font-bold">Crear otro video</button></div>
     </>:<><div className="mx-auto h-20 w-20 rounded-[25px] bg-[#f0e6fa] grid place-items-center">
       <span aria-hidden="true" className="h-10 w-10 rounded-full border-4 border-[#d8c2ef] border-t-[#764ac6] animate-spin"/></div>
       <h2 className="mt-5 text-2xl font-extrabold">{jobError?'Revisa tu generación':'Tu video está en proceso'}</h2>
       <p className="text-sm text-[#84768e] mt-3">{jobError||'Realizo ya envió tu solicitud. Puedes salir de esta pantalla; el trabajo se guarda en Mis videos.'}</p>
       {!jobError&&<><div role="status" aria-live="polite" className="mt-7 rounded-2xl border border-[#e9dfef] bg-[#fbf8fd] px-4 py-4">
         <div className="flex items-center justify-between text-[13px]"><span className="font-bold">Generación con Seedance 2.0</span><span className="text-[#875bb0] animate-pulse">● Procesando</span></div>
         <div className="mt-3 h-2.5 w-full bg-[#e7ddef] overflow-hidden rounded-full" role={providerPercent!==null?'progressbar':'status'} aria-valuenow={providerPercent!==null?providerPercent:undefined} aria-valuemin={providerPercent!==null?0:undefined} aria-valuemax={providerPercent!==null?100:undefined}>
           <div className={'h-full bg-gradient-to-r from-[#d8bdf7] to-[#8352d2] rounded-full transition-all '+(providerPercent===null?'animate-pulse':'')} style={{width:(providerPercent!==null?providerPercent:42)+'%'}}/>
         </div>
         <p className="text-xs text-[#897c92] mt-3">{providerPercent!==null?'Avance informado por el proveedor: '+providerPercent+'%':'Generación activa. El proveedor todavía no ha enviado un porcentaje verificable.'}</p>
       </div>{pollError&&<p role="status" className="mt-3 text-xs text-[#856f9a]">{pollError}</p>}</>}
       {jobId&&<p className="mt-4 text-[11px] text-[#978b9f] break-all">Trabajo: {jobId} · Estado: {jobStatus||'enviado'}</p>}
       <div className="flex flex-wrap justify-center gap-3 mt-7"><button type="button" onClick={onViewVideos} className="bg-[#7650c7] text-white px-6 py-3 rounded-2xl font-bold">Ver Mis videos</button>
         {jobError&&<button type="button" onClick={restart} className="border border-[#e4d9eb] px-5 py-3 rounded-2xl font-bold">Crear nuevo</button>}</div>
     </>}
   </section>}
   <p className="mt-5 text-center text-[11px] leading-5 text-[#92869c]">Realizo respeta las referencias y el guion, pero la IA no puede garantizar fidelidad perfecta en cada fotograma.</p>
 </div>;
}
