'use client';

import Link from 'next/link';
import {useEffect,useMemo,useRef,useState} from 'react';
import {extractGeneratedVideoUrl} from '@/lib/realizo-creative/wallet-generation';

// Prompt libre is deliberately isolated from the commercial guided wizard.
// These are the currently configured MuAPI reference-video models (not text-only endpoints).
const ENGINES=[
 {id:'seedance',label:'Seedance 2.0',model:'seedance-2-omni-reference',min:4,max:15,defaultDuration:8,maxImages:9,ratios:['9:16','1:1','16:9','3:4'],resolutions:[],quality:true,imageField:'images_list'},
 {id:'veo',label:'Veo 3.1',model:'veo3.1-reference-to-video',min:8,max:8,defaultDuration:8,maxImages:3,ratios:[],resolutions:['720p','1080p','4k'],quality:false,imageField:'images_list'},
 {id:'kling',label:'Kling 4.0',model:'kling-4.0-reference-to-video',min:3,max:30,defaultDuration:10,maxImages:10,ratios:['9:16','1:1','16:9','21:9'],resolutions:['720p','1080p'],quality:false,imageField:'image_urls'}
];
const dollars=cents=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((Number(cents)||0)/100);
const FIELD='w-full rounded-2xl border border-[#514365] bg-[#24202e] px-4 py-3 text-[#fbf7ff] outline-none placeholder:text-[#a99ab9] focus:border-[#b191e3] focus:ring-2 focus:ring-[#8263b6]/30';
const BOX='rounded-[24px] border border-[#43374f] bg-[#1b1a23] p-5 sm:p-7';
const minLength=20;
const maxLength=3500;
const engineById=id=>ENGINES.find(e=>e.id===id)||ENGINES[0];
function buildFreeInput(engine,values,photos){
 const input={prompt:values.prompt.trim(),duration:Number(values.duration)};
 const urls=photos.map(p=>p.url);
 input[engine.imageField]=urls;
 if(engine.ratios.length)input.aspect_ratio=values.ratio;
 if(engine.resolutions.length)input.resolution=values.resolution;
 if(engine.quality)input.quality=values.quality;
 if(engine.id==='veo')input.generate_audio=true;
 return input;
}
export default function RealizoFreePrompt({accountId,uploadAsset,onWalletRefresh,onViewVideos}){
 const [engineId,setEngineId]=useState('seedance');
 const engine=engineById(engineId);
 const [values,setValues]=useState({prompt:'',duration:8,ratio:'9:16',resolution:'720p',quality:'high'});
 const [photos,setPhotos]=useState([]);
 const [uploading,setUploading]=useState(false);
 const [error,setError]=useState('');
 const [quoting,setQuoting]=useState(false);
 const [quote,setQuote]=useState(null);
 const [quoteError,setQuoteError]=useState('');
 const [sending,setSending]=useState(false);
 const [jobId,setJobId]=useState('');
 const [jobStatus,setJobStatus]=useState('');
 const [progress,setProgress]=useState(null);
 const [videoUrl,setVideoUrl]=useState('');
 const [jobError,setJobError]=useState('');
 const [pollError,setPollError]=useState('');
 const uploadRef=useRef(null);
 const idempotencyRef=useRef(null);
 const walletCallback=useRef(onWalletRefresh);
 const activeKey='realizo:prompt-libre:active:'+accountId;
 useEffect(()=>{walletCallback.current=onWalletRefresh},[onWalletRefresh]);
 useEffect(()=>{
   try{
     const saved=JSON.parse(sessionStorage.getItem(activeKey)||'null');
     if(saved && /^[a-f0-9-]{30,70}$/i.test(saved.id) && ENGINES.some(e=>e.id===saved.engine)){
       setEngineId(saved.engine);setJobId(saved.id);setJobStatus('submitted');
     }
   }catch{}
 },[activeKey]);
 const input=useMemo(()=>buildFreeInput(engine,values,photos),[engine,values,photos]);
 const signature=JSON.stringify({model_id:engine.model,input});
 const validPrompt=values.prompt.trim().length>=minLength&&values.prompt.trim().length<=maxLength;
 const referencesValid=photos.length>0&&photos.length<=engine.maxImages;
 function change(key,value){
   setValues(old=>({...old,[key]:value}));setQuote(null);setQuoteError('');setError('');
 }
 function chooseEngine(id){
   const next=engineById(id);
   setEngineId(next.id);
   setValues(old=>({...old,duration:next.defaultDuration,ratio:next.ratios[0]||'9:16',resolution:next.resolutions[0]||'720p',quality:'high'}));
   setPhotos(old=>old.slice(0,next.maxImages));
   setQuote(null);setQuoteError('');setError('');idempotencyRef.current=null;
 }
 async function upload(files){
   if(!files?.length||uploading)return;
   const remaining=engine.maxImages-photos.length;
   if(remaining<1){setError('El límite para '+engine.label+' es '+engine.maxImages+' referencias.');return;}
   setUploading(true);setError('');
   try{
     for(const file of Array.from(files).slice(0,remaining)){
       if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('Cada imagen debe ser PNG, JPG o WebP de máximo 8 MB.');
       const url=await uploadAsset(file);
       if(!url)throw Error('No se pudo subir la imagen.');
       setPhotos(prev=>[...prev,{id:crypto.randomUUID(),name:file.name,url}].slice(0,engine.maxImages));
     }
     setQuote(null);setQuoteError('');
   }catch(e){setError(e.message||'Error al subir una referencia.');}
   finally{setUploading(false);}
 }
 async function requestQuote(){
   if(!validPrompt){setError('Escribe tu propio prompt (mínimo 20 caracteres).');return;}
   if(!referencesValid){setError('Los tres motores seleccionados son de video con referencias. Sube al menos una foto para cotizar.');return;}
   setQuote(null);setQuoteError('');setError('');setQuoting(true);
   const requestSignature=signature;
   try{
     const response=await fetch('/api/wallet/quote',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({model_id:engine.model,input})});
     const result=await response.json().catch(()=>({}));
     if(!response.ok)throw Error(({
       model_not_ready_for_generation:'El servicio de generación no está disponible.',
       muapi_generation_route_not_found:'La ruta de este modelo no está disponible en MuAPI.',
       muapi_generation_route_unverifiable:'No se pudo comprobar la ruta de MuAPI.',
       provider_price_inputs_invalid:'El modelo rechazó estos parámetros.',
       model_pricing_unavailable:'MuAPI no devolvió un precio válido.',
       invalid_media_reference:'Una fotografía venció. Elimínala y súbela nuevamente.'
     })[result.error]||'No se pudo calcular el precio ('+(result.error||'error')+'). No se realizó ningún cargo.');
     setQuote({...result,signature:requestSignature});
   }catch(e){setQuoteError(e.message||'Cotización no disponible.');}
   finally{setQuoting(false);}
 }
 async function generate(){
   if(sending||quoting||!validPrompt||!referencesValid||!quote?.affordable||quote.signature!==signature)return;
   setSending(true);setJobError('');
   if(!idempotencyRef.current)idempotencyRef.current=crypto.randomUUID();
   try{
     const response=await fetch('/api/wallet/generate',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({model_id:engine.model,input,max_price_cents:quote.price_cents,idempotency_key:idempotencyRef.current})});
     const result=await response.json().catch(()=>({}));
     if(!response.ok){
       if(result.error==='price_changed_confirm_again'){setQuote(null);idempotencyRef.current=null;throw Error('El precio cambió. Consulta y confirma el nuevo costo.');}
       if(result.error==='insufficient_funds')throw Error('Saldo insuficiente. Revisa tus créditos.');
       throw Error('No se inició la generación ('+(result.error||'error')+'). Revisa Mis creaciones antes de reintentar.');
     }
     if(!result.job_id)throw Error('No se recibió un identificador. Revisa Mis creaciones.');
     setJobId(result.job_id);setJobStatus(result.status||'reserved');
     try{sessionStorage.setItem(activeKey,JSON.stringify({id:result.job_id,engine:engine.id}));}catch{}
     walletCallback.current?.();
   }catch(e){setJobError(e.message||'No se pudo iniciar.');}
   finally{setSending(false);}
 }
 useEffect(()=>{
   if(!jobId||videoUrl||jobError)return;
   let stopped=false;let timer;
   async function poll(){
     try{
       const response=await fetch('/api/wallet/jobs/'+encodeURIComponent(jobId),{credentials:'same-origin',cache:'no-store'});
       const result=await response.json().catch(()=>({}));
       if(stopped)return;
       if(!response.ok&&response.status!==202)throw Error('No se pudo consultar el trabajo.');
       if(result.polling_error){setPollError('Consultando el estado de MuAPI…');}
       else{
         setPollError('');setJobStatus(result.status||'submitted');
         setProgress(Number.isInteger(result.provider_progress_percent)?result.provider_progress_percent:null);
         if(result.status==='completed'){
           const url=extractGeneratedVideoUrl(result);
           if(url)setVideoUrl(url);else setJobError('Generación completada, pero falta el enlace. Revisa Mis creaciones.');
           try{sessionStorage.removeItem(activeKey);}catch{}
           walletCallback.current?.();return;
         }
         if(result.status==='failed'||result.status==='unknown'){
           setJobError(result.status==='failed'
             ?(result.release_confirmed===true?'La generación falló y los créditos reservados fueron liberados.':'La generación falló. Consulta el saldo antes de reintentar.')
             :'El proveedor no confirmó el resultado. No vuelvas a cobrar; revisa Mis creaciones.');
           if(result.status==='failed')try{sessionStorage.removeItem(activeKey);}catch{}
           walletCallback.current?.();return;
         }
       }
     }catch{if(!stopped)setPollError('No se pudo actualizar el estado. Tu trabajo sigue disponible en Mis creaciones.');}
     if(!stopped)timer=setTimeout(poll,3500);
   }
   poll();
   return ()=>{stopped=true;clearTimeout(timer)};
 },[jobId,videoUrl,jobError,activeKey]);
 function restart(){
   setJobId('');setJobStatus('');setVideoUrl('');setJobError('');setProgress(null);setQuote(null);
   setError('');setQuoteError('');setPhotos([]);setValues(old=>({...old,prompt:''}));idempotencyRef.current=null;
   try{sessionStorage.removeItem(activeKey);}catch{}
 }
 return <div className="mx-auto max-w-[1070px] text-[#f9f6ff] pb-14" data-testid="realizo-prompt-libre">
   <div className="mb-6 rounded-[28px] border border-[#4f4164] p-6 sm:p-8" style={{background:'linear-gradient(110deg,#181821,#2b213b)'}}>
     <p className="text-[11px] uppercase tracking-[.17em] font-extrabold text-[#c9adf1]">REALIZO · MODO LIBRE</p>
     <h1 className="mt-2 text-[29px] sm:text-[36px] font-extrabold">Crea con tu propio prompt<span className="text-[#ee9289]">.</span></h1>
     <p className="mt-2 text-[13px] leading-6 text-[#d3c7db]">Tú escribes la idea completa. Sin cuestionario, guion automático ni escenas obligatorias. El servidor conserva sus controles generales de realismo y seguridad.</p>
   </div>
   {jobId ? <section className={BOX+' text-center'}>
     {videoUrl?<><h2 className="text-2xl font-extrabold">Tu video está listo</h2>
       <video src={videoUrl} controls playsInline data-realizo-owned-video="true" className="mt-5 mx-auto w-full max-w-[410px] rounded-2xl bg-black"/>
       <div className="flex justify-center gap-3 mt-6 flex-wrap"><button type="button" onClick={onViewVideos} className="rounded-xl bg-[#7650c5] px-5 py-3 text-white font-bold">Mis creaciones</button><button type="button" onClick={restart} className="rounded-xl border border-[#675779] px-5 py-3">Nuevo prompt libre</button></div>
     </>:<><h2 className="text-2xl font-extrabold">{jobError?'Revisa tu generación':'Generando con '+engine.label}</h2>
       <p className="mt-3 text-[#c8b9d7] text-sm">{jobError||'Tu video seguirá en proceso aunque cierres esta ventana.'}</p>
       {!jobError&&<div className="mt-5 rounded-xl border border-[#544565] bg-[#282232] p-4"><strong>{progress!==null?'Progreso del proveedor: '+progress+'%':'Esperando avance verificable del proveedor…'}</strong>
         <div className="mt-3 h-2 rounded-full bg-[#40364d] overflow-hidden"><div className="h-full bg-[#b08beb] transition-all" style={{width:(progress??40)+'%'}}/></div>
         {pollError&&<p role="status" className="mt-3 text-[12px] text-[#c8b9d7]">{pollError}</p>}</div>}
       <p className="mt-4 text-xs text-[#c8b9d7]">Trabajo: {jobId} · {jobStatus}</p>
       <button type="button" onClick={onViewVideos} className="mt-5 rounded-xl bg-[#7650c5] px-5 py-3 text-white font-bold">Ir a Mis creaciones</button>
       {jobError&&<button type="button" onClick={restart} className="ml-3 rounded-xl border border-[#675779] px-5 py-3">Nuevo prompt</button>}
     </>}
   </section> : <div className="space-y-5">
     <section className={BOX}>
       <h2 className="text-lg font-extrabold mb-3">1. Elige la IA de video</h2>
       <div className="grid sm:grid-cols-3 gap-3">
         {ENGINES.map(e=><button key={e.id} type="button" onClick={()=>chooseEngine(e.id)} aria-pressed={engineId===e.id}
           className={'rounded-2xl border px-4 py-5 text-left '+(engineId===e.id?'border-[#c6a0fc] bg-[#3b2d50] ring-1 ring-[#9d77db]':'border-[#52445f] bg-[#262330] hover:border-[#aa83dc]')}>
           <strong className="block text-[17px]">{e.label}</strong><span className="block text-[12px] text-[#c5b3d5] mt-1">{e.min===e.max?e.min+' segundos fijos':e.min+' a '+e.max+' segundos'}</span>
         </button>)}
       </div>
     </section>
     <section className={BOX}>
       <h2 className="text-lg font-extrabold mb-3">2. Escribe tu prompt libre</h2>
       <label htmlFor="realizo-free-prompt-text" className="block text-[13px] text-[#d2c6df] mb-2">Describe exactamente qué debe pasar, qué se ve y qué se escucha.</label>
       <textarea id="realizo-free-prompt-text" className={FIELD+' min-h-[220px] resize-y'} maxLength={maxLength} value={values.prompt}
         onChange={e=>change('prompt',e.target.value)} placeholder="Ej.: Anuncio vertical hiperrealista. Una persona habla a cámara en español latino, muestra el producto, explica un beneficio real y cierra invitando a escribir por WhatsApp. Sin silencios; cortes cada 3 segundos…" />
       <div className="flex flex-wrap justify-between gap-2 mt-2 text-[12px] text-[#c6b7d2]"><span>{values.prompt.trim().length}/{maxLength} caracteres · mínimo {minLength}</span><span>Se conserva tu texto; no se sustituye por un guion automático.</span></div>
     </section>
     <section className={BOX}>
       <h2 className="text-lg font-extrabold mb-3">3. Fotos de referencia y configuración</h2>
       <p className="text-[12px] text-[#cdbfda] mb-3">Estos tres endpoints son de video con imágenes de referencia: requieren al menos una foto. La primera se usa como identidad del producto, no necesariamente como primer fotograma.</p>
       <input ref={uploadRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={e=>{upload(e.target.files);e.target.value='';}}/>
       <button type="button" disabled={uploading||photos.length>=engine.maxImages} onClick={()=>uploadRef.current?.click()}
         className="w-full min-h-[100px] rounded-2xl border-2 border-dashed border-[#8266a1] bg-[#2a2434] hover:bg-[#34283e] disabled:opacity-50 p-5 font-extrabold">
         {uploading?'Subiendo…':photos.length?'Añadir referencias':'Subir foto de referencia'} <span className="block text-[12px] font-normal text-[#cbbbd8] mt-1">{photos.length}/{engine.maxImages} · JPG, PNG o WebP · máximo 8 MB por imagen</span>
       </button>
       {photos.length>0&&<div className="flex flex-wrap gap-3 mt-4">{photos.map((p,i)=><div key={p.id} className="relative h-24 w-24 rounded-xl border border-[#655574] bg-[#211e2a] overflow-hidden">
         <img src={p.url} alt={i===0?'Producto principal':'Referencia '+(i+1)} className="w-full h-full object-contain"/>
         <button type="button" aria-label={'Quitar referencia '+(i+1)} onClick={()=>{setPhotos(old=>old.filter(x=>x.id!==p.id));setQuote(null);}} className="absolute right-1 top-1 bg-[#2a2037] rounded-full text-red-200 px-2">×</button></div>)}</div>}
       <div className="grid sm:grid-cols-2 gap-4 mt-5">
         <label className="text-[13px] font-bold text-[#e6dbf0]">Duración
           <select className={FIELD+' mt-2'} value={values.duration} onChange={e=>change('duration',Number(e.target.value))}>
             {Array.from({length:engine.max-engine.min+1},(_,i)=>i+engine.min).map(n=><option value={n} key={n}>{n} segundos</option>)}
           </select></label>
         {engine.ratios.length>0&&<label className="text-[13px] font-bold text-[#e6dbf0]">Formato
           <select className={FIELD+' mt-2'} value={values.ratio} onChange={e=>change('ratio',e.target.value)}>{engine.ratios.map(r=><option key={r} value={r}>{r}</option>)}</select></label>}
         {engine.resolutions.length>0&&<label className="text-[13px] font-bold text-[#e6dbf0]">Resolución
           <select className={FIELD+' mt-2'} value={values.resolution} onChange={e=>change('resolution',e.target.value)}>{engine.resolutions.map(r=><option key={r} value={r}>{r}</option>)}</select></label>}
         {engine.quality&&<label className="text-[13px] font-bold text-[#e6dbf0]">Calidad
           <select className={FIELD+' mt-2'} value={values.quality} onChange={e=>change('quality',e.target.value)}><option value="high">Alta calidad</option><option value="basic">Económico</option></select></label>}
       </div>
       {engine.id==='veo'&&<p className="mt-3 text-[12px] text-[#c8b5da]">Veo 3.1 con referencias dura 8 segundos y habilita audio. Este endpoint no expone un control de formato.</p>}
     </section>
     <section className={BOX}>
       <h2 className="text-lg font-extrabold mb-2">4. Precio y generación</h2>
       <p className="text-[13px] text-[#cabdd7]">Consulta el precio real de MuAPI, incluyendo el margen del servicio, antes de autorizar el cargo. Nada se genera al cotizar.</p>
       {error&&<p role="alert" className="mt-3 text-sm text-[#ffb2bd]">{error}</p>}
       <button type="button" onClick={requestQuote} disabled={quoting||uploading||!validPrompt||!referencesValid}
         className="mt-4 rounded-xl border border-[#a782dc] px-5 py-3 text-[#f4eaff] font-bold disabled:opacity-40">{quoting?'Calculando…':'Consultar precio'}</button>
       {quote&&quote.signature===signature&&<div className="mt-4 rounded-2xl border border-[#6c518d] bg-[#30263f] p-4">
         <p className="text-[#d8c6ef] text-[12px]">Costo total por este video</p><strong className="text-[30px]">{dollars(quote.price_cents)}</strong>
         <p className="text-[12px] text-[#d5c7df] mt-1">Saldo disponible: {dollars(quote.available_cents)} · {engine.label} · {values.duration} s</p>
         {!quote.affordable&&<Link href="/wallet" className="mt-3 inline-block underline text-[#e6ccff] font-bold">Recargar créditos</Link>}
       </div>}
       {quoteError&&<p role="alert" className="mt-3 text-sm text-[#ffb2bd]">{quoteError}</p>}
       {jobError&&<p role="alert" className="mt-3 text-sm text-[#ffb2bd]">{jobError}</p>}
       <button type="button" onClick={generate}
         disabled={!validPrompt||!referencesValid||sending||quoting||!quote?.affordable||quote?.signature!==signature}
         className="w-full mt-4 rounded-2xl bg-[#7750c7] hover:bg-[#6941b2] disabled:opacity-40 p-4 font-extrabold text-white">
         {sending?'Iniciando…':'Confirmar '+(quote?.signature===signature?dollars(quote.price_cents):'precio')+' y generar'}
       </button>
       <p className="mt-3 text-center text-[11px] text-[#c8bbd3]">No se hace ningún cobro sin tu confirmación. Si cambias texto, IA, fotos o ajustes, la cotización anterior deja de ser válida.</p>
     </section>
   </div>}
 </div>;
}
