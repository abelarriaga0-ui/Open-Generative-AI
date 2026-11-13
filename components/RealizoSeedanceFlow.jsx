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
const INPUT='w-full rounded-2xl border border-[#454052] bg-[#24242e] px-4 py-3.5 text-[#f6f2fc] placeholder:text-[#a59bb4] outline-none focus:border-[#aa84e6] focus:ring-2 focus:ring-[#7655b4]/40';
const CARD='rounded-[26px] border border-[#35313f] bg-[#191a22] shadow-[0_14px_42px_rgba(0,0,0,.19)]';
const DURATION_OPTIONS=Array.from({length:12},(_,i)=>i+4); // Seedance 2.0 supported range: 4–15 seconds
const usd=value=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((value||0)/100);
const INITIAL={name:'',description:'',style:'auto',audience:'',market:'Ecuador',objective:'sales',
  ratio:'9:16',duration:8,resolution:'720p',quality:'high',cta:'Escríbenos por WhatsApp',notes:'',problem:'',benefit:'',sceneLines:{}};

function compactSpeech(value,maxWords=9){
  const words=String(value||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
  if(!words.length)return '';
  const selected=words.slice(0,maxWords).join(' ').replace(/[,;:\s]+$/,'');
  return /[.!?…]$/.test(selected)?selected:selected+'.';
}
function productCategory(d){
  const text=(d.name+' '+d.description).toLocaleLowerCase('es');
  if(/perfume|fragancia|aroma|colonia|esencia|feromona|body wash|gel de ducha/.test(text))return 'aroma';
  if(/shampoo|champú|cabello|capilar|caspa|cuero cabelludo|barba/.test(text))return 'cabello';
  if(/limpieza|limpiar|desinfectar|hogar|cocina|ordenar/.test(text))return 'hogar';
  if(/crema|piel|loción|cosmético/.test(text))return 'cuidado';
  return 'general';
}
function buildScenePlan(d){
  const total=Number(d.duration)||8;
  const category=productCategory(d);
  const name=d.name.trim()||'este producto';
  const defaults={
    aroma:{hook:'¿Buscas un aroma para tu estilo?',problem:'No cualquier fragancia va con tu rutina.',benefit:'Haz del aroma parte de tu estilo.',visual:'Aplicación real, aroma y preparación para salir'},
    cabello:{hook:'¿Buscas renovar tu rutina capilar?',problem:'Elegir bien para tu cabello importa.',benefit:'Un paso más para tu cuidado diario.',visual:'Uso visible y correcto del producto en el cabello'},
    hogar:{hook:'¿Quieres simplificar tu rutina?',problem:'Las tareas cotidianas requieren soluciones prácticas.',benefit:'Mira cómo integrarlo en tu día.',visual:'Manos mostrando el uso real y su resultado observable'},
    cuidado:{hook:'¿Buscas algo para tu cuidado diario?',problem:'Tu rutina merece una elección consciente.',benefit:'Un paso práctico en tu rutina.',visual:'Textura y aplicación real, sin prometer resultados'},
    general:{hook:'¿Buscas algo útil para tu rutina?',problem:'Elegir el producto adecuado puede costar.',benefit:'Mira cómo incorporarlo a tu día.',visual:'Demostración física de uso real, sin funciones inventadas'}
  }[category];
  const hook=defaults.hook;
  const problem=compactSpeech(d.problem,9)||defaults.problem;
  const benefit=compactSpeech(d.benefit,9)||defaults.benefit;
  const productLine='Te presento '+name+'.';
  const cta=d.cta?.toLowerCase().includes('whatsapp')?'Escríbenos por WhatsApp.':'Escríbenos para conocerlo.';
  const isDirect=d.style==='ugc'||d.style==='auto';
  const voice=isDirect?'El mismo adulto habla directamente a cámara, boca sincronizada':'Voz en off audible sobre la acción, en español latino';
  const specs=total<=7?[
    {id:'hook',role:'HOOK + PROBLEMA',line:'¿Buscas algo diferente?',visual:'Abrir con el problema o deseo reconocible, movimiento humano inmediato y producto en cuadro'},
    {id:'close',role:'PRODUCTO + SOLUCIÓN + CTA',line:'Conoce '+name+'. Escríbenos.',visual:'Mostrar producto real y una acción breve y plausible; cerrar con persona y producto'}
  ]:total<=11?[
    {id:'hook',role:'HOOK',line:'¿Buscas algo diferente?',visual:'Persona a cámara o problema visible desde el primer fotograma; producto temprano'},
    {id:'problem',role:'PROBLEMA',line:compactSpeech(d.problem,5)||'Elegir bien no siempre es fácil.',visual:'Situación cotidiana concreta que expresa el deseo, sin inventar una prueba'},
    {id:'solution',role:'SOLUCIÓN + DEMO',line:'Conoce '+name+'.',visual:'Presentar envase fiel, manos y uso real, con un corte claro'},
    {id:'close',role:'BENEFICIO + CTA',line:'Escríbenos para conocerlo.',visual:'Resultado observable o utilidad real; persona cierra mirando a cámara'}
  ]:[
    {id:'hook',role:'HOOK',line:hook,visual:'Iniciar en acción desde 0.0s; persona a cámara, producto cercano y gesto que detiene el scroll'},
    {id:'problem',role:'PROBLEMA / DESEO',line:problem,visual:'Situación cotidiana y reconocible del comprador; acción distinta del primer plano'},
    {id:'solution',role:'PRODUCTO / SOLUCIÓN',line:productLine,visual:'Presentar '+name+' con etiqueta, tapa, escala y colores intactos; mismo actor'},
    {id:'benefit',role:'DEMOSTRACIÓN / BENEFICIO',line:benefit,visual:defaults.visual+'; mostrar, no inventar un resultado'},
    {id:'close',role:'CIERRE / CTA',line:cta,visual:'Regresar al rostro que habla a cámara con producto visible; cierre comercial sin packshot mudo'}
  ];
  const n=specs.length;
  return specs.map((scene,i)=>{
    const from=Number((i*total/n).toFixed(1));
    const to=i===n-1?total:Number(((i+1)*total/n).toFixed(1));
    const seconds=Number((to-from).toFixed(1));
    return {...scene,from,to,seconds,maxWords:Math.max(4,Math.floor(seconds*2.8)),
      line:String(d.sceneLines?.[scene.id]??scene.line).trim(),
      audioInstruction:voice};
  });
}
function scriptFor(d){
  const name=d.name.trim();
  const scenes=buildScenePlan(d);
  const identity='@image1 REFERENCIA OBLIGATORIA DE IDENTIDAD de '+name+'. Conserva marca, etiqueta, tipografía, color, tapa, envase, geometría y proporciones. La imagen NO es primer fotograma; filma escenas nuevas realistas.';
  const extra=Array.from({length:8},(_,i)=>i+2).filter(i=>i<=d.imageCount)
    .map(i=>'@image'+i+' es referencia adicional, nunca sustituye @image1.').join(' ');
  const context='MERCADO: '+d.market+'. PÚBLICO: '+(d.audience.trim()||'compradores interesados')+'. OBJETIVO: '+(OBJECTIVES.find(x=>x.id===d.objective)?.name||'Generar ventas')+'.';
  const voice=d.style==='ugc'||d.style==='auto'
    ?'UGC: mismo actor adulto visible que MIRA Y HABLA A CÁMARA desde el primer segundo, sincronía labial y voz natural en ESPAÑOL LATINO.'
    :'NARRADOR: VOZ EN OFF clara y audible en español latino sobre las imágenes, sin montaje mudo.';
  const shots=scenes.map((scene,i)=>
    'ESCENA '+(i+1)+' — '+scene.from+' a '+scene.to+' s ('+scene.seconds+' s; CORTE OBLIGATORIO, nunca toma mayor de 4 s). '+scene.role+
    '\nVISUAL: '+scene.visual+'. Cámara y acción cambian respecto a la toma anterior. No repetir acción.'+
    '\nAUDIO: pronunciar TEXTUALMENTE en este intervalo: «'+scene.line+'». Voz audible, dicción rápida pero natural; no dejar la frase solo como texto en pantalla.'
  ).join('\n');
  const details='PRODUCTO: '+name+'. Datos aportados por el vendedor: '+(d.description.trim().slice(0,390)||'sin detalles adicionales')+'. Sin resultados clínicos, feromonas efectivas, atracción garantizada, testimonios, descuentos ni urgencia inventados.';
  const rules='CONTRATO EDITORIAL: anuncio de respuesta directa, NO video de producto decorativo. Hook audible y visual desde 0 s; plantear problema/deseo; presentar producto, uso visible, beneficio sustentado y CTA HABLADO al final. Audio verbal durante las escenas, sin silencios largos, sin voz solo al final, sin música que oculte la voz. CORTES REALES: cada escena dura como máximo 4 segundos y debe cambiar encuadre, acción e información. Mismo personaje, espacio, vestuario y objeto entre tomas. Física, manos y rostro naturales; nada de envases CGI flotando, mutación de etiquetas o gestos repetitivos. No generar subtítulos con letras falsas; dejar espacio seguro para subtítulos de edición.';
  const additional=d.notes.trim()?'NOTAS DEL USUARIO: '+d.notes.trim().slice(0,350):'';
  return ['ANUNCIO COMERCIAL CON DIÁLOGO OBLIGATORIO. DURACIÓN TOTAL '+d.duration+' s.',identity,extra,context,voice,
    'GUION TEMPORIZADO / STORYBOARD (obligatorio, no sugerencias):',shots,rules,details,additional].filter(Boolean).join('\n').slice(0,3900);
}
function Option({chosen,onClick,title,detail,icon}){
 return <button type="button" onClick={onClick} aria-pressed={chosen}
   className={'group rounded-[20px] border px-4 py-4 text-left transition flex gap-3 items-start min-h-[91px] '+
     (chosen?'border-[#a77ce7] bg-[#362a4b] shadow-[0_6px_22px_rgba(120,80,190,.17)]':'border-[#3b3547] bg-[#22232d] hover:border-[#906bc5] hover:bg-[#2a2636]')}>
   <span className={'h-10 w-10 shrink-0 rounded-xl grid place-items-center text-xl '+(chosen?'bg-[#a67ced] text-[#160f24]':'bg-[#393047] text-[#d5bafb]')}>{icon||'✦'}</span>
   <span className="min-w-0"><strong className="block text-sm text-[#f7f3fc]">{title}</strong><small className="block mt-1 text-[12px] leading-5 text-[#bbb1cb]">{detail}</small></span>
   {chosen&&<span className="ml-auto text-[#d8bdff] font-extrabold">✓</span>}
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
 const scenePlan=useMemo(()=>buildScenePlan(d),[d]);
 const dialogueTooLong=scenePlan.some(scene=>scene.line.split(/\s+/).filter(Boolean).length>scene.maxWords);
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
   if(sending||dialogueTooLong||!quote||quote.signature!==signature||!quote.affordable)return;
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
 return <div className="mx-auto max-w-[1070px] pb-14 text-[#f7f3fc]">
   <div className="rounded-[30px] border border-[#3c334a] bg-gradient-to-r from-[#181820] to-[#2b213a] px-6 py-5 sm:px-8 mb-6 flex flex-wrap items-center justify-between gap-3" style={{background:"linear-gradient(105deg,#181820 0%,#2b213a 100%)",color:"#faf8ff"}}>
     <div><p className="text-[10px] tracking-[.22em] font-extrabold uppercase text-[#c4a4f2]">Realizo · creación guiada</p>
       <h1 className="mt-1 text-[25px] sm:text-[32px] font-extrabold tracking-tight text-[#faf8ff]">Tu idea cobra vida<span className="text-[#ee9289]">.</span></h1>
       <p className="text-[13px] text-[#c6bacf] mt-1">Un paso a la vez · Seedance 2.0 · imágenes de referencia</p></div>
     {step<7&&<span className="rounded-full border border-[#554469] bg-[#282132] px-4 py-2 text-[12px] font-bold text-[#d3b2ff]">Paso {step+1} de 7</span>}
   </div>
   {step<7&&<div data-testid="realizo-duration-shortcut" className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-[22px] border border-[#56466d] bg-[#211d2c] px-5 py-4">
     <div>
       <p className="text-[10px] font-extrabold uppercase tracking-[.17em] text-[#cdb2f1]">Duración de tu video</p>
       <p className="mt-1 text-[18px] font-extrabold text-[#faf8ff]">¿Cuánto debe durar?</p>
       <p className="mt-1 text-[12px] text-[#c6b8d3]">Seedance 2.0 · entre 4 y 15 segundos por generación</p>
     </div>
     <div className="flex flex-wrap items-center gap-3">
       <div className="rounded-2xl border border-[#635081] bg-[#30273e] px-4 py-2 text-center" role="status" aria-live="polite">
         <strong className="block text-[22px] font-extrabold leading-none text-[#f6eaff]">{d.duration} s</strong>
         <span className="text-[10px] text-[#cebadd]">Seleccionados</span>
       </div>
       <label className="block">
         <span className="block text-[11px] font-bold text-[#ddd2eb] mb-1">Cambiar duración</span>
         <select aria-label="Seleccionar duración del video en segundos" className="min-h-11 min-w-[144px] rounded-xl border border-[#8067a5] bg-[#30283c] px-3 py-2 text-[#fffafc] font-bold outline-none focus:ring-2 focus:ring-[#b292df]" value={d.duration} onChange={e=>change('duration',Number(e.target.value))}>
           {DURATION_OPTIONS.map(n=><option key={n} value={n}>{n} segundos</option>)}
         </select>
       </label>
     </div>
   </div>}
   {step<7&&<div className="mb-6">
     <div className="flex items-center justify-between text-[12px] text-[#c3afda] mb-2"><strong>Preparación del anuncio</strong><span>{percentage}%</span></div>
     <div className="w-full h-2.5 rounded-full bg-[#302a3d] overflow-hidden" role="progressbar" aria-valuenow={percentage} aria-valuemin="0" aria-valuemax="100" aria-label="Preparación">
       <div className="h-full rounded-full bg-gradient-to-r from-[#a87aff] to-[#f6a16b] transition-all duration-500" style={{width:percentage+'%'}}/>
     </div>
   </div>}
   {step<7&&<section className={CARD+' px-5 py-7 sm:px-9 sm:py-9'} style={{backgroundColor:'#191a22',color:'#f7f3fc'}}>
     <div className="mb-7"><p className="uppercase tracking-[.18em] text-[#bd9ce9] text-[10px] font-extrabold">Realizo te pregunta</p>
       <h2 className="mt-2 text-[25px] sm:text-[32px] font-extrabold tracking-tight text-[#faf8ff]">{QUESTIONS[step].title}</h2>
       <p className="mt-2 text-[13px] sm:text-sm text-[#c7bdcf] leading-6">{QUESTIONS[step].hint}</p></div>

     {step===0&&<div className="space-y-5">
       <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden"
         onChange={e=>{addPhotos(e.target.files);e.target.value='';}}/>
       <button type="button" onClick={()=>fileInput.current?.click()} disabled={uploading||photos.length>=9}
         className="w-full min-h-[175px] rounded-[24px] border-2 border-dashed border-[#7f639f] bg-[#25222f] hover:border-[#b292df] hover:bg-[#30293e] disabled:opacity-60 px-5 py-8 transition text-center">
         <span className="mx-auto mb-2 h-12 w-12 rounded-2xl bg-[#443157] text-[#e1c9ff] grid place-items-center text-2xl">＋</span>
         <strong className="block text-sm text-[#f7f3fc]">{uploading?'Subiendo imágenes…':photos.length?'Agregar más referencias':'Subir fotos de referencia'}</strong>
         <span className="block text-[12px] text-[#b7a9c8] mt-2">JPG, PNG, WebP · máximo 8 MB por imagen · {photos.length}/9</span>
       </button>
       {photos.length>0&&<div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
         {photos.map((p,i)=><div key={p.id} className="relative aspect-square rounded-2xl overflow-hidden border border-[#443c50] bg-[#272330]">
           <img src={p.url} className="h-full w-full object-contain" alt={i===0?'Foto principal del producto':'Referencia adicional '+i}/>
           <span className="absolute left-1 top-1 rounded-full bg-[#231c30]/95 px-2 py-0.5 text-[10px] font-bold text-[#e1cbff]">{i===0?'Producto':'Ref. '+(i+1)}</span>
           <button type="button" onClick={()=>{setPhotos(items=>items.filter(x=>x.id!==p.id));setQuote(null);}} aria-label="Quitar imagen"
             className="absolute top-1 right-1 h-6 w-6 rounded-full bg-[#231c30]/95 text-[#ff9aab] font-bold">×</button>
         </div>)}
       </div>}
       <p className="text-[12px] text-[#bdb1c9]">La primera imagen identifica el producto. Las demás pueden mostrar una persona, un lugar u otros ángulos del mismo envase.</p>
     </div>}
     {step===1&&<div className="space-y-5">
       <label className="block"><span className="text-[13px] font-bold block mb-2">Nombre del producto *</span>
         <input autoFocus className={INPUT} maxLength={120} placeholder="Ej. GODA para hombre" value={d.name} onChange={e=>change('name',e.target.value)}/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Qué hace y cómo se usa?</span>
         <textarea rows={4} className={INPUT+' resize-y'} maxLength={1300} placeholder="Describe beneficios y usos que puedas respaldar…" value={d.description} onChange={e=>change('description',e.target.value)}/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Qué problema o deseo tiene tu comprador? <span className="font-normal text-[#b7aaca]">(recomendado)</span></span>
         <input className={INPUT} maxLength={160} value={d.problem} onChange={e=>change('problem',e.target.value)} placeholder="Ej. Quiero que mi aroma encaje con mi estilo"/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Qué beneficio real podemos comunicar? <span className="font-normal text-[#b7aaca]">(recomendado)</span></span>
         <input className={INPUT} maxLength={160} value={d.benefit} onChange={e=>change('benefit',e.target.value)} placeholder="Ej. Aroma para acompañar mi rutina"/></label>
       <p className="text-[12px] text-[#c6b5d7]">La IA propone un guion si no completas estos datos. No inventará resultados clínicos ni testimonios.</p>
       {preview&&<div className="flex items-center gap-3 rounded-2xl bg-[#25232e] border border-[#3e3649] p-3"><img src={preview} alt="" className="w-14 h-14 object-contain rounded-lg"/><span className="text-[12px] text-[#c4b8d0]">Tu producto se conservará visualmente en las tomas.</span></div>}
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
       <fieldset><legend className="text-[13px] font-bold mb-3">¿Cuánto dura mi video?</legend>
         <div className="grid grid-cols-4 gap-2">{[5,8,10,15].map(n=><button type="button" key={n} aria-pressed={d.duration===n} aria-label={n+' segundos'} onClick={()=>change('duration',n)}
           className={'min-h-[48px] rounded-2xl border py-3 text-sm font-bold transition '+(d.duration===n?'bg-[#7953ca] text-white border-[#a77ce7] ring-2 ring-[#ba9af0]':'bg-[#22232d] border-[#454052] text-[#d2c7df] hover:border-[#aa88d4]')}>{n} s</button>)}</div>
         <p className="text-[12px] text-[#c2b0d3] mt-3">Elegiste <strong className="text-[#f6eaff]">{d.duration} segundos</strong>. Para elegir 4, 6, 7, 9, 11, 12, 13 o 14 segundos, usa el selector «Cambiar duración» de arriba.</p>
         <p className="text-[12px] text-[#bcb0c9] mt-2">Seedance 2.0 admite de 4 a 15 segundos por solicitud. La cotización se ajustará a tu elección; para 30 o 45 segundos se necesitaría otro flujo de varias generaciones.</p></fieldset>
       <fieldset><legend className="text-[13px] font-bold mb-3">Calidad de imagen</legend>
         <div className="grid sm:grid-cols-2 gap-3">{[['720p','720p · equilibrado'],['1080p','1080p · alta definición']].map(([v,label])=><Option key={v} title={label} detail={v==='1080p'?'Mayor resolución y costo':'Buena calidad con menor costo'} chosen={d.resolution===v} onClick={()=>change('resolution',v)}/>)}</div></fieldset>
       <fieldset><legend className="text-[13px] font-bold mb-3">Modo de calidad</legend>
         <div className="grid sm:grid-cols-2 gap-3">{[['high','Máxima calidad'],['basic','Más económico']].map(([v,label])=><Option key={v} title={label} detail={v==='high'?'Prioriza fidelidad y detalle':'Prioriza costo y rapidez'} chosen={d.quality===v} onClick={()=>change('quality',v)}/>)}</div></fieldset>
     </div>}
     {step===5&&<div className="space-y-5">
       <label className="block"><span className="text-[13px] font-bold block mb-2">Llamado a la acción</span>
         <input className={INPUT} maxLength={150} value={d.cta} onChange={e=>change('cta',e.target.value)} placeholder="Ej. Escríbenos por WhatsApp"/></label>
       <label className="block"><span className="text-[13px] font-bold block mb-2">¿Algo especial que quieras incluir? <span className="font-normal text-[#afa6bb]">(opcional)</span></span>
         <textarea className={INPUT+' resize-y'} rows={4} maxLength={450} value={d.notes} onChange={e=>change('notes',e.target.value)}
           placeholder="Ej. Dos planos con la misma persona y el producto en mano…"/></label>
       <p className="text-[12px] text-[#bdb2c9]">El sistema preparará un guion visual acorde con la duración, sin añadir datos comerciales que no proporcionaste.</p>
     </div>}
     {step===6&&<div className="space-y-5">
       <div className="rounded-[22px] border border-[#5e4778] bg-[#272132] p-4 sm:p-5">
         <p className="text-[10px] uppercase tracking-[.17em] font-extrabold text-[#c9aafa]">Director comercial de Realizo</p>
         <h3 className="mt-1 text-[19px] font-extrabold text-[#f8f4ff]">Tu video, escena por escena</h3>
         <p className="mt-1 text-[12px] leading-5 text-[#d0c3db]">Cada toma dura 4 segundos o menos. Revisa y modifica exactamente lo que se escuchará antes de pagar.</p>
         <div className="mt-4 space-y-3">
           {scenePlan.map((scene,i)=><div key={scene.id} className="rounded-2xl border border-[#4c405b] bg-[#1b1b25] p-4">
             <div className="flex flex-wrap justify-between items-center gap-2">
               <strong className="text-[12px] tracking-wide text-[#e6d1ff]">ESCENA {i+1} · {scene.role}</strong>
               <span className="rounded-full bg-[#392d4b] px-3 py-1 text-[11px] font-bold text-[#d5b6ff]">{scene.from}–{scene.to} s · {scene.seconds} s</span>
             </div>
             <p className="mt-3 text-[12px] text-[#c9bfce]"><strong className="text-[#f5ebff]">Visual:</strong> {scene.visual}</p>
             <label className="block mt-3">
               <span className="text-[12px] font-bold text-[#ddc5ff]">Texto hablado · español latino</span>
               <input className={INPUT+' mt-1'} aria-label={'Diálogo hablado, escena '+(i+1)} maxLength={140}
                 value={scene.line} onChange={e=>change('sceneLines',{...d.sceneLines,[scene.id]:e.target.value})}/>
             </label>
             <p className={'mt-2 text-[11px] '+(scene.line.split(/\s+/).filter(Boolean).length>scene.maxWords?'text-[#ffb3ac]':'text-[#b8a7c5]')}>
               {scene.line.split(/\s+/).filter(Boolean).length}/{scene.maxWords} palabras recomendadas para esta toma
             </p>
           </div>)}
         </div>
         {dialogueTooLong&&<p role="alert" className="mt-4 text-[12px] font-bold text-[#ffb3ac]">Acorta los diálogos marcados: las palabras deben caber en su escena. El cargo está bloqueado hasta corregirlos.</p>}
         {d.duration<12&&<p className="mt-3 text-[12px] text-[#d8bedc]">Para contar hook, problema, solución y cierre con claridad, recomendamos 12–15 segundos. En videos más breves se comprimen etapas.</p>}
         <p className="mt-3 text-[12px] text-[#bfb0cc]">Seedance puede incumplir instrucciones de voz o montaje. El guion explícito reduce la ambigüedad, pero no garantiza sincronía ni audio final.</p>
       </div>
       <div className="grid sm:grid-cols-[145px_1fr] gap-5 bg-[#24232e] border border-[#42394f] rounded-[22px] p-4">
         {preview&&<img src={preview} className="h-40 w-full rounded-2xl object-contain bg-[#171820]" alt="Producto seleccionado"/>}
         <div className="space-y-2"><strong className="text-lg">{d.name}</strong>
           <p className="text-[13px] text-[#c2b7ce]">{styleName} · {d.duration}s · {d.ratio} · {d.resolution} · {d.quality==='high'?'Alta calidad':'Económico'}</p>
           <p className="text-[13px] text-[#c2b7ce]">Dirigido a {d.market||'tu mercado'} · {OBJECTIVES.find(x=>x.id===d.objective)?.name}</p>
           <p className="text-[12px] text-[#c6a5de]">{photos.length} {photos.length===1?'referencia visual':'referencias visuales'} · Seedance 2.0</p>
         </div>
       </div>
       <details className="rounded-2xl border border-[#44384e] p-4 bg-[#22212b]"><summary className="cursor-pointer text-[13px] font-bold text-[#d2b2ff]">Ver las instrucciones de tu video</summary>
         <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-[11px] leading-5 text-[#c6bbd0]">{prompt}</pre></details>
       <div className="rounded-2xl bg-[#2a2438] border border-[#4c3c63] p-5">
         <p className="text-[12px] font-bold text-[#c8a4f2] mb-2">Cotización de generación</p>
         {quoting?<p role="status" className="font-bold animate-pulse">Consultando precio real…</p>:
           quote&&quote.signature===signature?<><p className="text-[29px] font-extrabold">{usd(quote.price_cents)}</p>
             <p className="mt-1 text-[12px] text-[#c4b4d3]">Saldo disponible: {usd(quote.available_cents)}. El cargo se reserva solo al confirmar.</p>
             {!quote.affordable&&<Link href="/wallet" className="mt-3 inline-block underline font-bold text-[#784fbd]">Recargar créditos</Link>}</>:
           <p role="alert" className="text-[#ffadb4] text-sm">{quoteError||'Precio no disponible. No puedes generar hasta obtener una cotización.'}</p>}
       </div>
       {jobError&&<p role="alert" className="text-[13px] text-[#ffadb4]">{jobError}</p>}
       <button type="button" onClick={startGeneration} disabled={sending||quoting||dialogueTooLong||!quote?.affordable||quote.signature!==signature}
         className="w-full rounded-2xl bg-[#7750c7] text-white disabled:opacity-45 hover:bg-[#6841b8] px-6 py-4 font-extrabold text-sm transition">
         {sending?'Enviando solicitud…':'Confirmar '+(quote?.price_cents?usd(quote.price_cents):'')+' y generar video'}
       </button>
       <p className="text-center text-[11px] text-[#bfb2c9]">Nunca se genera ni se cobra sin tu confirmación. Si el precio cambia, se pedirá una nueva aprobación.</p>
     </div>}
     {step<6&&uploadError&&<p className="mt-5 text-[13px] text-[#a64e60]" role="alert">{uploadError}</p>}
     {step<6&&<div className="mt-9 flex flex-wrap justify-between gap-3 border-t border-[#3d3549] pt-6">
       <button type="button" onClick={back} disabled={step===0||uploading}
         className="rounded-2xl border border-[#4b415a] px-5 py-3 font-bold text-sm text-[#d0bfdc] disabled:opacity-35">← Atrás</button>
       <button type="button" onClick={next} disabled={uploading}
         className="rounded-2xl bg-[#7650c6] px-6 py-3 font-bold text-sm text-white hover:bg-[#653cb5] disabled:opacity-50">Continuar →</button>
     </div>}
     {step===6&&<button type="button" onClick={back} className="mt-4 text-[13px] font-bold underline text-[#d0aaff]">← Cambiar configuración</button>}
   </section>}
   {step===7&&<section className={CARD+' p-6 sm:p-9 text-center'} style={{backgroundColor:'#191a22',color:'#f7f3fc'}}>
     {videoUrl?<><div className="mx-auto rounded-full bg-[#244334] w-14 h-14 grid place-items-center text-[#95edb9] text-2xl">✓</div>
       <h2 className="mt-4 text-2xl font-extrabold">¡Tu video está listo!</h2>
       <p className="text-sm text-[#c7bdcf] mt-2">Se guardó en tu biblioteca de creaciones.</p>
       <video src={videoUrl} controls playsInline data-realizo-owned-video="true" className="mx-auto mt-6 w-full max-w-[360px] max-h-[570px] rounded-2xl bg-black"/>
       <div className="flex flex-wrap justify-center gap-3 mt-6"><button type="button" onClick={onViewVideos} className="bg-[#7550c7] text-white rounded-2xl px-6 py-3 font-bold">Ir a Mis videos</button>
         <button type="button" onClick={restart} className="border border-[#55465f] rounded-2xl px-6 py-3 font-bold">Crear otro video</button></div>
     </>:<><div className="mx-auto h-20 w-20 rounded-[25px] bg-[#392b4d] grid place-items-center">
       <span aria-hidden="true" className="h-10 w-10 rounded-full border-4 border-[#68537d] border-t-[#764ac6] animate-spin"/></div>
       <h2 className="mt-5 text-2xl font-extrabold">{jobError?'Revisa tu generación':'Tu video está en proceso'}</h2>
       <p className="text-sm text-[#c1b6cb] mt-3">{jobError||'Realizo ya envió tu solicitud. Puedes salir de esta pantalla; el trabajo se guarda en Mis videos.'}</p>
       {!jobError&&<><div role="status" aria-live="polite" className="mt-7 rounded-2xl border border-[#43374e] bg-[#262330] px-4 py-4">
         <div className="flex items-center justify-between text-[13px]"><span className="font-bold">Generación con Seedance 2.0</span><span className="text-[#875bb0] animate-pulse">● Procesando</span></div>
         <div className="mt-3 h-2.5 w-full bg-[#3a2e49] overflow-hidden rounded-full" role={providerPercent!==null?'progressbar':'status'} aria-valuenow={providerPercent!==null?providerPercent:undefined} aria-valuemin={providerPercent!==null?0:undefined} aria-valuemax={providerPercent!==null?100:undefined}>
           <div className={'h-full bg-gradient-to-r from-[#ad87f1] to-[#f39a74] rounded-full transition-all '+(providerPercent===null?'animate-pulse':'')} style={{width:(providerPercent!==null?providerPercent:42)+'%'}}/>
         </div>
         <p className="text-xs text-[#bbb0c9] mt-3">{providerPercent!==null?'Avance informado por el proveedor: '+providerPercent+'%':'Generación activa. El proveedor todavía no ha enviado un porcentaje verificable.'}</p>
       </div>{pollError&&<p role="status" className="mt-3 text-xs text-[#c7a9e4]">{pollError}</p>}</>}
       {jobId&&<p className="mt-4 text-[11px] text-[#baafc4] break-all">Trabajo: {jobId} · Estado: {jobStatus||'enviado'}</p>}
       <div className="flex flex-wrap justify-center gap-3 mt-7"><button type="button" onClick={onViewVideos} className="bg-[#7650c7] text-white px-6 py-3 rounded-2xl font-bold">Ver Mis videos</button>
         {jobError&&<button type="button" onClick={restart} className="border border-[#50445d] px-5 py-3 rounded-2xl font-bold">Crear nuevo</button>}</div>
     </>}
   </section>}
   <p className="mt-5 text-center text-[11px] leading-5 text-[#b4aabe]">Realizo respeta las referencias y el guion, pero la IA no puede garantizar fidelidad perfecta en cada fotograma.</p>
 </div>;
}
