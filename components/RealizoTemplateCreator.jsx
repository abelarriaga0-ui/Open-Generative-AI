'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
import {optimizeImage} from '@/lib/realizo-creative/optimize-image';
import {extractGeneratedVideoUrl} from '@/lib/realizo-creative/wallet-generation';
import {TEMPLATE_MODEL_ID} from '@/lib/realizo-creative/template-video-input';

const money=c=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format(Number(c||0)/100);
const inputClass='realizo-template-field';
const errorMap={
 invalid_product_or_image:'Sube una fotografía válida y escribe qué producto vendes.',
 template_ai_unavailable:'No fue posible adaptar el guion en este momento.',
 template_ai_incomplete:'No fue posible completar la adaptación. Inténtalo otra vez.',
 template_script_needs_review:'El diálogo no tiene una duración natural de 30 segundos. Vuelve a prepararlo.',
 locked_template_prompt_too_long:'La información es demasiado extensa para esta plantilla. Reduce la descripción.',
 invalid_media_reference:'Tu fotografía caducó. Vuelve a subirla.',
 unsupported_model:'Este modelo de Muapi no está disponible en este momento.',
 unsupported_model_endpoint:'Este modelo no tiene una ruta válida en Muapi.',
 model_pricing_unavailable:'Muapi no proporcionó un precio verificable. No se ha cobrado nada.',
 muapi_catalog_unavailable:'No se pudo consultar el precio en Muapi.',
 insufficient_funds:'Saldo insuficiente. Recarga para continuar.',
 price_changed_confirm_again:'El precio cambió. Necesitas volver a confirmar el importe.'
};
async function read(r){
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(errorMap[data.error]||('No fue posible completar la solicitud ('+(data.error||r.status)+').'));
 return data;
}
async function pause(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

export default function RealizoTemplateCreator({onBack,onWalletRefresh,onViewVideos}){
 const [photo,setPhoto]=useState(null);
 const [productName,setProductName]=useState('');
 const [description,setDescription]=useState('');
 const [changeRequest,setChangeRequest]=useState('');
 const [actor,setActor]=useState('hombre');
 const [setting,setSetting]=useState('');
 const [prepared,setPrepared]=useState(null);
 const [quote,setQuote]=useState(null);
 const [phase,setPhase]=useState('idle');
 const [error,setError]=useState('');
 const [generated,setGenerated]=useState(null);
 const [jobId,setJobId]=useState(null);
 const fileInput=useRef(null),key=useRef(null);
 const busy=['uploading','preparing','quoting','generating'].includes(phase);
 function invalidate(){
   setPrepared(null);setQuote(null);setGenerated(null);setError('');
   if(!jobId)key.current=null;
 }
 async function upload(file){
   if(!file)return;
   if(busy)return;
   invalidate();setPhoto(null);setPhase('uploading');
   try{
     if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('Selecciona JPG, PNG o WEBP.');
     const compressed=await optimizeImage(file);
     const body=new FormData();body.append('image',compressed);
     const res=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body});
     const result=await read(res);
     setPhoto({id:result.id,url:result.url});
   }catch(e){setError(e.message)}
   finally{setPhase('idle')}
 }
 async function prepare(){
   if(!photo||!productName.trim()||description.trim().length<15){
     setError('Sube la foto, escribe el nombre y una descripción de al menos 15 caracteres.');
     return;
   }
   setError('');setPhase('preparing');
   try{
     const preparedVideo=await read(await fetch('/api/realizo/template/prepare',{
       method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({
         product_name:productName,description,image_url:photo.url,
         actor,setting:setting||'auto',change_request:changeRequest
       })
     }));
     if(preparedVideo.model_id!==TEMPLATE_MODEL_ID||preparedVideo.input?.duration!==30||
       preparedVideo.input?.videos_list!==null)throw Error('La plantilla no pudo verificarse.');
     setPrepared(preparedVideo);setPhase('quoting');
     const q=await read(await fetch('/api/wallet/quote',{
       method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({model_id:preparedVideo.model_id,input:preparedVideo.input})
     }));
     if(!Number.isSafeInteger(q.price_cents)||q.price_cents<=0)throw Error('El precio no es válido.');
     setQuote(q);
   }catch(e){setError(e.message);setQuote(null)}
   finally{setPhase('idle')}
 }
 async function generate(){
   if(!quote||!prepared||busy||jobId)return;
   if(!quote.affordable){setError('No tienes saldo suficiente para crear este video.');return;}
   const idempotency=key.current||crypto.randomUUID();
   key.current=idempotency;setError('');setPhase('generating');
   try{
     const result=await read(await fetch('/api/wallet/generate',{
       method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({
         model_id:prepared.model_id,input:prepared.input,
         idempotency_key:idempotency,max_price_cents:quote.price_cents
       })
     }));
     if(result.status==='unknown'){
       setJobId(result.job_id||'pending');
       throw Error('Muapi puede haber recibido la solicitud. Consulta Mis videos; no vuelvas a pagar.');
     }
     if(!result.job_id)throw Error('No se recibió identificador. Revisa Mis videos.');
     setJobId(result.job_id);
     onWalletRefresh?.();
     for(let attempt=0;attempt<240;attempt++){
       await pause(3000);
       const poll=await read(await fetch('/api/wallet/jobs/'+encodeURIComponent(result.job_id),
         {credentials:'same-origin',cache:'no-store'}));
       if(poll.status==='completed'){
         const url=extractGeneratedVideoUrl(poll);
         if(!url)throw Error('Muapi terminó pero no devolvió un video. Consulta Mis videos.');
         setGenerated(url);setPhase('completed');onWalletRefresh?.();return;
       }
       if(poll.status==='failed')throw Error('La generación falló. Consulta Mis videos para verificar la devolución.');
       if(poll.status==='unknown')throw Error('La generación requiere conciliación. No hagas otro pago.');
     }
     throw Error('El video sigue procesándose. Puedes consultarlo en Mis videos.');
   }catch(e){setError(e.message);setPhase('idle')}
 }
 return <section className="realizo-template-creator" aria-label="Crear video desde plantilla">
   <button type="button" className="realizo-template-back" onClick={onBack}>← Volver a plantillas</button>
   <div className="realizo-template-creator-head">
     <span className="realizo-v11-eyebrow">PLANTILLA MAESTRA</span>
     <h1>UGC Vendedor <em>· 30 segundos</em></h1>
     <p>Sube tu producto y adapta el anuncio original. Cámara, montaje, duración y modelo permanecen iguales.</p>
     <div className="realizo-template-chips"><span>Muapi · Seedance 2.5</span><span>30 s</span><span>9:16</span><span>Español</span></div>
   </div>
   <div className="realizo-template-creator-grid">
     <div className="realizo-template-panel">
       <h2>Tu producto</h2>
       <input type="file" ref={fileInput} accept="image/jpeg,image/png,image/webp" className="sr-only"
         onChange={e=>{upload(e.target.files?.[0]);e.target.value='';}}/>
       <button type="button" className="realizo-template-upload" disabled={busy||Boolean(jobId)}
         onClick={()=>fileInput.current?.click()}>
         {photo?<img src={photo.url} alt="Fotografía de tu producto" />:<><span className="realizo-template-upload-icon">＋</span><strong>Subir fotografía</strong><small>JPG, PNG o WEBP</small></>}
       </button>
       <label>Nombre del producto
         <input className={inputClass} maxLength={100} placeholder="Ej. Irrigador bucal"
           disabled={busy||Boolean(jobId)} value={productName} onChange={e=>{setProductName(e.target.value);invalidate()}}/>
       </label>
       <label>Descripción y beneficios
         <textarea className={inputClass} rows={4} maxLength={320} placeholder="¿Qué es, cómo se utiliza y qué beneficio ofrece?"
           disabled={busy||Boolean(jobId)} value={description} onChange={e=>{setDescription(e.target.value);invalidate()}}/>
       </label>
     </div>
     <div className="realizo-template-panel">
       <h2>Personalización <span>(opcional)</span></h2>
       <p>Por defecto se conserva el hombre y el baño del anuncio original.</p>
       <div className="realizo-template-two">
        <label>Personaje
          <select className={inputClass} value={actor} disabled={busy||Boolean(jobId)}
            onChange={e=>{setActor(e.target.value);invalidate()}}>
            <option value="hombre">Hombre (original)</option>
            <option value="mujer">Mujer</option>
          </select>
        </label>
        <label>Escenario
          <input className={inputClass} maxLength={120} value={setting} disabled={busy||Boolean(jobId)}
           placeholder="Baño de casa (original)" onChange={e=>{setSetting(e.target.value);invalidate()}}/>
        </label>
       </div>
       <label>¿Qué quieres cambiar?
         <textarea className={inputClass} rows={4} maxLength={350} disabled={busy||Boolean(jobId)}
          placeholder="Ej. Cambia el personaje por una mujer. Mantén todo lo demás igual."
          value={changeRequest} onChange={e=>{setChangeRequest(e.target.value);invalidate()}}/>
       </label>
       {!quote&&!jobId&&<button className="realizo-template-primary" type="button" disabled={busy}
          onClick={prepare}>{phase==='preparing'?'Adaptando el anuncio…':phase==='quoting'?'Consultando precio…':'Ver precio del video →'}</button>}
       {quote&&!jobId&&<div className="realizo-template-quote" role="region" aria-label="Precio de generación">
         <span>Precio exacto de esta generación</span>
         <strong>{money(quote.price_cents)}</strong>
         <small>Saldo disponible: {money(quote.available_cents)} · Muapi cobra la generación después de confirmar. La adaptación del guion no tiene otro cargo para el cliente.</small>
         <button className="realizo-template-primary" type="button" disabled={busy||!quote.affordable}
          onClick={generate}>Confirmar y generar · {money(quote.price_cents)}</button>
         {!quote.affordable&&<p>Saldo insuficiente. <Link href="/wallet">Recargar créditos</Link></p>}
       </div>}
       {jobId&&!generated&&<div className="realizo-template-quote" role="status">
         <strong>Generación enviada</strong><p>Muapi está creando tu video. No se volverá a cobrar esta solicitud.</p>
         <button type="button" className="realizo-template-back" onClick={onViewVideos}>Ver Mis videos</button>
       </div>}
       {error&&<p role="alert" className="realizo-template-error">{error}</p>}
       {generated&&<div className="realizo-template-result">
         <h3>Tu video está listo</h3><video src={generated} controls playsInline preload="metadata"/>
         <a href={generated} download target="_blank" rel="noreferrer">Ver o guardar video ↗</a>
         <button type="button" onClick={onViewVideos}>Ir a Mis videos</button>
       </div>}
     </div>
   </div>
   <p className="realizo-template-note">El video mantiene el mismo prompt y estructura de la plantilla. El resultado visual puede variar porque Muapi genera cada toma con IA.</p>
 </section>;
}
