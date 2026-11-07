'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {optimizeImage} from '@/lib/realizo-creative/optimize-image';
import {normalizeHyperrealProBrief,planHyperrealProScenes} from '@/lib/realizo-creative/hyperreal-pro';
import {hyperrealModelFamilies,resolveHyperrealModelFamily} from '@/lib/realizo-creative/hyperreal-model-routing';
import styles from './RealizoHyperrealPro.module.css';

const initial={product_name:'',description:'',audience:'',angle:'',actor:'',location:'',cta:'',
 spoken_script:'',duration:30,format:'9:16',speak:true};
const failures={
  invalid_media_reference:'La foto de referencia venció. Vuelve a subirla.',
  invalid_video_configuration:'El motor no admite esta configuración. Prueba otra duración o modelo.',
  reference_image_model_required:'Este motor no admite referencias visuales en esa duración.',
  text_video_model_required:'Este motor no admite texto a video en esa duración.',
  document_ai_unavailable:'La extracción no pudo completarse. Intenta nuevamente más tarde.',
  document_daily_limit:'Has llegado al límite de tres documentos por día.',
  document_result_invalid:'La IA no pudo recuperar una ficha fiable de este documento.',
  document_without_readable_text:'Este documento no contiene texto que pueda extraerse.',
  unsupported_document:'Sube PDF (hasta 4 MB), DOCX (hasta 2 MB) o TXT (hasta 200 KB).',
  document_ai_not_configured:'La extracción documental no está disponible en este momento.'
};
const control={display:'block',marginTop:7};
const caption='text-[#CBC0D7] text-xs leading-6';

export default function RealizoHyperrealPro({guest=false,onWalletGenerate,onGenerationComplete,onWalletRefresh,onViewCreations}){
 const [brief,setBrief]=useState(initial);
 const [photo,setPhoto]=useState(null),[preview,setPreview]=useState('');
 const [documentFile,setDocumentFile]=useState(null);
 const [docId,setDocId]=useState(''),[docStatus,setDocStatus]=useState('');
 const [docResult,setDocResult]=useState(null),[docBusy,setDocBusy]=useState(false);
 const [config,setConfig]=useState(null),[familyId,setFamilyId]=useState('realizo-kling-4.0');
 const [prepared,setPrepared]=useState(null),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState('');
 const [phase,setPhase]=useState(''),[submittedJob,setSubmittedJob]=useState('');
 const [completed,setCompleted]=useState(null);
 const docRequestKey=useRef('');
 const families=useMemo(()=>hyperrealModelFamilies(config?.video_options||[]),[config]);
 const seconds=Number(brief.duration),hasImage=Boolean(photo);
 const available=f=>{try{
   resolveHyperrealModelFamily(config?.video_options||[],f.id,seconds,{hasImage});
   return true;
 }catch{return false;}};
 const selected=families.find(f=>f.id===familyId);
 const validModel=Boolean(selected&&available(selected));
 const failText=msg=>failures[msg]||String(msg||'No se pudo continuar.');
 const change=(key,value)=>{
   setBrief(v=>({...v,[key]:value}));setPrepared(null);setCompleted(null);setError('');
 };
 const applyDocument=data=>{
   if(!data)return;
   setBrief(v=>({...v,product_name:data.product_name||v.product_name,
     description:data.description||v.description,audience:data.audience||v.audience,
     angle:data.angle||v.angle}));
   setPrepared(null);setNotice('Información importada. Puedes corregirla antes de generar.');
 };
 useEffect(()=>{
   if(guest)return;
   fetch('/api/realizo/ai-premium',{credentials:'same-origin',cache:'no-store'})
     .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);setConfig(j);})
     .catch(e=>setError(failText(e.message)));
   fetch('/api/realizo/hyperreal/document',{credentials:'same-origin',cache:'no-store'})
     .then(async r=>r.ok?r.json():null).then(j=>{
       if(!j?.job_id)return;
       if(['starting','submitted'].includes(j.status)){
         setDocId(j.job_id);setDocStatus(j.status);
       }else if(j.status==='completed'){
         setDocStatus('completed');setDocResult(j.result);
       }
     }).catch(()=>{});
 },[guest]);
 useEffect(()=>{
   if(!photo){setPreview('');return;}
   const url=URL.createObjectURL(photo);setPreview(url);
   return ()=>URL.revokeObjectURL(url);
 },[photo]);
 useEffect(()=>{
   if(!validModel){
     const first=families.find(available);
     if(first&&first.id!==familyId)setFamilyId(first.id);
   }
 },[familyId,seconds,hasImage,families]);
 useEffect(()=>{
   if(!docId||!['starting','submitted'].includes(docStatus))return;
   let stopped=false,timer;
   async function poll(){
     try{
       const r=await fetch('/api/realizo/hyperreal/document?job_id='+encodeURIComponent(docId),
         {credentials:'same-origin',cache:'no-store'});
       const j=await r.json().catch(()=>({}));
       if(stopped)return;
       if(!r.ok)throw Error(j.error);
       if(j.status==='completed'){
         setDocStatus('completed');setDocResult(j.result);setDocBusy(false);
         applyDocument(j.result);
       }else if(j.status==='failed'){
         setDocBusy(false);setDocStatus('failed');setError(failText(j.error));
       }else{
         setDocStatus(j.status);timer=setTimeout(poll,3500);
       }
     }catch{if(!stopped)timer=setTimeout(poll,5500);}
   }
   timer=setTimeout(poll,2500);
   return ()=>{stopped=true;clearTimeout(timer);};
 },[docId,docStatus]);
 const choosePhoto=e=>{
   const f=e.target.files?.[0]||null;
   if(f&&(!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>8*1024*1024)){
     setError('Sube una foto JPG, PNG o WebP de hasta 8 MB.');return;
   }
   setPhoto(f);setPrepared(null);setError('');
 };
 const chooseDoc=e=>{
   const f=e.target.files?.[0]||null;
   if(f&&!/\.(pdf|docx|txt|md)$/i.test(f.name)){setError(failures.unsupported_document);return;}
   setDocumentFile(f);setDocResult(null);setDocId('');setDocStatus('');setError('');setDocBusy(false);
 };
 const analyzeDocument=async()=>{
   if(guest){window.location.assign('/login');return;}
   if(!documentFile||docBusy)return;
   setDocBusy(true);setError('');setNotice('');setDocResult(null);
   docRequestKey.current=crypto.randomUUID();
   try{
     const form=new FormData();form.append('document',documentFile,documentFile.name);
     form.append('request_key',docRequestKey.current);
     const r=await fetch('/api/realizo/hyperreal/document',
       {method:'POST',credentials:'same-origin',body:form});
     const j=await r.json().catch(()=>({}));
     if(!r.ok||!j.job_id)throw Error(j.error||'document_ai_unavailable');
     setDocId(j.job_id);setDocStatus(j.status);
     setNotice('Leyendo la ficha. Puedes cerrar esta pantalla y volver después.');
   }catch(e){setDocBusy(false);setError(failText(e.message));}
 };
 const prepare=()=>{
   setError('');setNotice('');
   try{
     const value=normalizeHyperrealProBrief(brief);
     if(!validModel)throw Error(hasImage?'reference_image_model_required':'text_video_model_required');
     setPrepared({brief:value,familyId,scenes:planHyperrealProScenes(value)});
   }catch(e){setError(failText(e.message));}
 };
 const generate=async()=>{
   if(guest){window.location.assign('/login');return;}
   if(busy||!prepared||!validModel)return;
   setBusy(true);setError('');setNotice('');setCompleted(null);setSubmittedJob('');
   try{
     let imageUrl='';
     if(photo){
       setPhase('Preparando la foto...');
       const upload=new FormData(),file=await optimizeImage(photo);
       upload.append('image',file,file.name||'producto.jpg');
       const r=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body:upload});
       const j=await r.json().catch(()=>({}));
       if(!r.ok||!j.url)throw Error(j.error||'No se pudo subir la imagen.');
       imageUrl=j.url;
     }
     setPhase('Preparando instrucciones...');
     const r=await fetch('/api/realizo/hyperreal/prepare',{method:'POST',credentials:'same-origin',
       headers:{'Content-Type':'application/json'},
       body:JSON.stringify({brief:prepared.brief,family_id:prepared.familyId,
         ...(imageUrl?{image_url:imageUrl}:{})})});
     const result=await r.json().catch(()=>({}));
     if(!r.ok||!result.params)throw Error(result.error||'No se pudo preparar el video.');
     if(typeof onWalletGenerate!=='function')throw Error('Generación no disponible.');
     setPhase('Cotizando. Confirma el precio antes de pagar.');
     const job=await onWalletGenerate(result.params,{
       onSubmitted:id=>{setSubmittedJob(id);onWalletRefresh?.();
         setPhase('Video en proceso. Su estado aparece en Mis creaciones.');}
     });
     setCompleted(job);onWalletRefresh?.();onGenerationComplete?.(job);
   }catch(e){setError(failText(e.message));}
   finally{setBusy(false);setPhase('');}
 };
 return <section className={styles.shell}>
   <header className="mb-6">
     <span className={styles.stat}>✦ Hiperrealista PRO</span>
     <h1 className="mt-3 text-[29px] sm:text-[38px] font-extrabold text-[#FBF4FF]">Videos que parecen reales.</h1>
     <p className={styles.muted}>Tu producto, varias tomas naturales y un mismo personaje.</p>
   </header>
   <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-6">
     <div className="space-y-5">
       <section className={styles.panel+' p-5 sm:p-7 space-y-5'}>
         <h2 className="text-xl font-extrabold text-[#FBF4FF]">1. Producto</h2>
         <label>Foto del producto <span className="text-[#B8AEC6] font-normal">(opcional)</span>
           <input type="file" style={control} accept="image/jpeg,image/png,image/webp" onChange={choosePhoto}/>
         </label>
         <div className={styles.softPanel+' p-4 space-y-3'}>
           <strong className="text-[#FAF4FF] text-sm">¿Tienes la documentación del producto?</strong>
           <label>Sube PDF, Word o TXT
             <input type="file" style={control}
               accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
               onChange={chooseDoc}/>
           </label>
           <button type="button" className={styles.secondary} disabled={!documentFile||docBusy}
             onClick={analyzeDocument}>{docBusy?'Analizando…':'Completar datos con IA'}</button>
           <p className={caption}>Hasta 3 lecturas al día sin descuento de créditos. El archivo se envía a la IA; revisa la información extraída.</p>
           {docStatus==='completed'&&docResult&&<div className={styles.success+' space-y-2'}>
             <p>Ficha del producto extraída.</p>
             <button type="button" className={styles.secondary} onClick={()=>applyDocument(docResult)}>Usar información</button>
             {docResult.missing_information&&<p className={caption}>Por confirmar: {docResult.missing_information}</p>}
             {docResult.safety_notes&&<p className={caption}>Precauciones: {docResult.safety_notes}</p>}
           </div>}
         </div>
         <div className="grid sm:grid-cols-2 gap-4">
           <label>Nombre del producto
             <input style={control} maxLength={90} value={brief.product_name}
               placeholder="Ej. GODA" onChange={e=>change('product_name',e.target.value)}/>
           </label>
           <label>Público objetivo <span className="text-[#B8AEC6] font-normal">(opcional)</span>
             <input style={control} maxLength={150} value={brief.audience}
               placeholder="Ej. Hombres adultos" onChange={e=>change('audience',e.target.value)}/>
           </label>
         </div>
         <label>Descripción y características comprobables
           <textarea style={control} maxLength={400} rows={3} value={brief.description}
             placeholder="Qué es y cómo se utiliza" onChange={e=>change('description',e.target.value)}/>
         </label>
         <label>Ángulo de venta <span className="text-[#B8AEC6] font-normal">(opcional)</span>
           <textarea style={control} maxLength={250} rows={2} value={brief.angle}
             placeholder="Ej. Rutina personal antes de salir" onChange={e=>change('angle',e.target.value)}/>
         </label>
       </section>
       <section className={styles.panel+' p-5 sm:p-7 space-y-5'}>
         <h2 className="text-xl font-extrabold text-[#FBF4FF]">2. Tu video</h2>
         <div className="grid sm:grid-cols-3 gap-4">
           <label>Duración
             <select style={control} value={brief.duration}
               onChange={e=>change('duration',Number(e.target.value))}>
               {[15,30,45].map(n=><option key={n} value={n}>{n} segundos</option>)}
             </select>
           </label>
           <label>Formato
             <select style={control} value={brief.format}
               onChange={e=>change('format',e.target.value)}>
               <option value="9:16">9:16 · Vertical</option>
               <option value="16:9">16:9 · Horizontal</option>
             </select>
           </label>
           <label>Voz
             <select style={control} value={brief.speak?'yes':'no'}
               onChange={e=>change('speak',e.target.value==='yes')}>
               <option value="yes">Hablar a cámara</option>
               <option value="no">Solo actividades</option>
             </select>
           </label>
         </div>
         <label>Modelo de generación
           <select style={control} value={familyId} onChange={e=>{
             setFamilyId(e.target.value);setPrepared(null);
           }}>
             {families.map(f=><option key={f.id} value={f.id} disabled={!available(f)}>
               {f.label}{available(f)?'':' · No compatible con esta duración/modalidad'}
             </option>)}
           </select>
         </label>
         <p className={caption}>{hasImage?'Realizo elegirá la variante que utiliza la fotografía como referencia.':
           'Sin fotografía, Realizo elegirá texto a video. Para fidelidad al envase, sube una foto.'}
           {' '}El costo se verifica y confirma antes de generar.</p>
         <details className={styles.softPanel+' p-4'}>
           <summary>Personalizar personaje, escenario, guion y CTA</summary>
           <div className="grid sm:grid-cols-2 gap-4 mt-4">
             <label>Persona
               <input style={control} maxLength={220} value={brief.actor}
                 placeholder="Ej. Hombre de 30 años, camiseta negra" onChange={e=>change('actor',e.target.value)}/>
             </label>
             <label>Escenario
               <input style={control} maxLength={170} value={brief.location}
                 placeholder="Ej. Habitación con luz de ventana" onChange={e=>change('location',e.target.value)}/>
             </label>
           </div>
           {brief.speak&&<label className="mt-3">Diálogo exacto <span className="text-[#B8AEC6] font-normal">(opcional)</span>
             <textarea style={control} maxLength={900} rows={3} value={brief.spoken_script}
               placeholder="Frases que dirá el personaje..." onChange={e=>change('spoken_script',e.target.value)}/>
           </label>}
           <label className="mt-3">Llamado a la acción
             <input style={control} maxLength={100} value={brief.cta}
               placeholder="Escríbenos para pedirlo" onChange={e=>change('cta',e.target.value)}/>
           </label>
         </details>
         <button type="button" className={styles.primary+' w-full'}
           disabled={busy||!validModel||!brief.product_name.trim()||!brief.description.trim()}
           onClick={prepare}>Preparar escenas</button>
         <p className={caption}>Preparar las escenas no descuenta créditos.</p>
       </section>
     </div>
     <div className="space-y-5">
       <section className={styles.panel+' p-5 sm:p-7 space-y-4'}>
         <h2 className="text-xl font-extrabold text-[#FBF4FF]">Vista previa</h2>
         <div className={styles.preview}>{preview?
           <img src={preview} alt="Referencia visual del producto"/>:
           <p className={styles.muted+' p-5 text-center'}>Tu producto aparecerá aquí</p>}</div>
         {prepared?.scenes?.length?<div>
           <p className={styles.muted+' font-bold mb-2'}>{prepared.scenes.length} tomas · {seconds} segundos</p>
           {prepared.scenes.map(shot=><div className={styles.timelineItem} key={shot.number}>
             <span className={styles.stat}>{shot.number}</span>
             <div><strong className="text-sm">{shot.title} · {shot.start}–{shot.end} s</strong>
               <p className={caption}>{shot.action}</p></div>
           </div>)}
         </div>:<p className={styles.muted}>Completa el producto y prepara las escenas para ver la propuesta.</p>}
       </section>
       {prepared&&<section className={styles.panel+' p-5 sm:p-7 space-y-3'}>
         <h3 className="text-xl font-extrabold text-[#FBF4FF]">3. Generar</h3>
         <p className={styles.muted}>Verás el precio exacto antes de autorizar el descuento.</p>
         <button type="button" className={styles.primary+' w-full'}
           disabled={busy} onClick={generate}>{busy?'Procesando…':guest?'Iniciar sesión':'Cotizar y generar'}</button>
         {busy&&<p role="status" className={styles.muted}>{phase}</p>}
         {submittedJob&&<p className={caption}>Trabajo registrado: {submittedJob}. Revisa Mis creaciones.</p>}
         {completed?.url&&<a href={completed.url} target="_blank" rel="noopener noreferrer"
           className="text-[#D5B4FF] underline text-sm">Ver video</a>}
         <button type="button" className={styles.secondary+' w-full'} onClick={onViewCreations}>Mis creaciones</button>
       </section>}
       {notice&&<div className={styles.success} role="status">{notice}</div>}
       {error&&<div className={styles.error} role="alert">{error}</div>}
       <p className={caption}>El realismo, los cortes y el audio dependen del modelo. En esta versión las tomas se dirigen dentro de una generación; aún no se montan clips independientes.</p>
     </div>
   </div>
 </section>;
}
