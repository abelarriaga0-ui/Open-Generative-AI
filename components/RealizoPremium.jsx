'use client';
import {useEffect,useRef,useState} from 'react';
import {optimizeImage} from '@/lib/realizo-creative/optimize-image';
import {getAdTemplate,templatePlan} from '@/lib/realizo-creative/ad-templates';
import {SALES_ANGLE_CHOICES} from '@/lib/realizo-creative/sales-angle';

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
const visualFor=c=>{
 const format=String(c.creative_style||'');
 if(format==='ugc')return previews.ugc;
 if(format==='cinematic')return previews.premium;
 if(format==='premium')return {icon:'💎',label:'Premium'};
 if(format==='demo')return previews.demo;
 return previews[String(c.angle||'').toLowerCase().split(/[ :/]/)[0]]||previews.benefits;
};
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

export default function RealizoPremium({onPrepare,onOpenAdvanced,onUseAutomatic,onCreateNew,onWalletRefresh,onWalletGenerate,onGenerationComplete,onViewCreations,initialStyle='ugc',initialProjectId=null,initialTemplateId=null}){
 const [config,setConfig]=useState(null),[image,setImage]=useState(null);
 const template=getAdTemplate(initialTemplateId);
 const [templateActor,setTemplateActor]=useState('hombre');
 const [templateChangeRequest,setTemplateChangeRequest]=useState('');
 const [templateSetting,setTemplateSetting]=useState('auto');
 const [product,setProduct]=useState({product_name:'',description:'',audience:'',
  angle:template?.angle||'auto',custom_angle:'',market:'EC',video_language:'es',cta:'',creative_style:template?.style||initialStyle,cast_mode:'with_people',audio_mode:'no_voice',video_model_id:'',video_duration_seconds:'',video_aspect_ratio:'',video_resolution:'',video_quality:''});
 const [project,setProject]=useState(null),[selection,setSelection]=useState(0);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [researchConfirm,setResearchConfirm]=useState(false);
 const [speechEdits,setSpeechEdits]=useState({}),[jobId,setJobId]=useState(null),[completed,setCompleted]=useState(false),[generationFailed,setGenerationFailed]=useState(false);
 useEffect(()=>{setSpeechEdits({});setJobId(null);setCompleted(false);setGenerationFailed(false)},[project?.id]);
 const fileRef=useRef(null),keyRef=useRef(null);
 useEffect(()=>{
  let active=true;
  fetch('/api/realizo/ai-premium',{cache:'no-store',credentials:'same-origin'})
   .then(r=>r.ok?r.json():Promise.reject()).then(async v=>{
     if(!active)return;
     setConfig(v);
     // Choose Seedance 2.5 as the starting engine; users can change freely
     // before committing the single paid investigation.
     const recommended=template?(v.video_options||[]).find(m=>m.id==='seedance-2.5-intl-omni-reference'):preferredVideoModel(v.video_options||[]);
     if(recommended)setProduct(prev=>prev.video_model_id?prev:{
      ...prev,video_model_id:recommended.id,
      video_duration_seconds:template?30:preferredDuration(recommended,prev.video_duration_seconds),
      video_aspect_ratio:recommended.aspect_ratios?.[0]||'',video_resolution:recommended.resolutions?.[0]||'',video_quality:recommended.qualities?.[0]||'',
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
  if(!project?.id || (!['created','researching'].includes(project.status)&&!(project.status==='needs_review'&&project.error==='research_launch_unconfirmed')))return;
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
 // Recover an already-completed OpenAI response automatically once, on
 // current failed projects too. This performs only a read, not a paid POST.
 useEffect(()=>{
  if(project?.status!=='failed'||project?.error!=='unusable_research'||!project.id)return;
  let active=true;
  fetch('/api/realizo/ai-premium/'+encodeURIComponent(project.id),{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject())
   .then(saved=>{if(active)setProject(saved)})
   .catch(()=>{});
  return()=>{active=false};
 },[project?.id,project?.status,project?.error]);
 useEffect(()=>{
  if(project?.concepts?.length===3){
   const i=Number.isInteger(project.findings?.recommended_index)?
    Math.max(0,Math.min(2,project.findings.recommended_index)):0;
   setSelection(i);
  }
 },[project?.id,project?.concepts]);
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
 const recoverStartedResearch=async(requestKey)=>{
   // A failing edge response can occur after atomic reservation. Recover the
   // SAME request by key; never repeat a paid OpenAI POST.
   try{
     const r=await fetch('/api/realizo/ai-premium?request_key='+encodeURIComponent(requestKey),{
       credentials:'same-origin',cache:'no-store'
     });
     if(r.ok){
       const saved=await r.json();
       if(saved?.id){setProject(saved);onWalletRefresh?.();return true;}
     }
   }catch{}
   return false;
 };
 const start=async()=>{
  if(!config?.enabled)return setError('La investigación de IA no está disponible en este momento.');
  if(!image?.id || product.description.trim().length<15)
    return setError('Sube una foto y describe el producto en al menos 15 caracteres.');
  if(product.angle==='custom'&&(product.custom_angle.trim().length<8||product.custom_angle.trim().length>240))
    return setError('Escribe tu ángulo de venta libre en 8 a 240 caracteres antes de investigar.');
  const chosen=(config.video_options||[]).find(m=>m.id===product.video_model_id);
  if(!chosen || !chosen.durations.includes(Number(product.video_duration_seconds)))
    return setError('Selecciona un motor de video y una duración compatible antes de investigar.');
  const price=config.customer_charge_cents;
  if(!Number.isInteger(price)||price<0)return setError('No se pudo cotizar la investigación.');
  const complimentary=config.billing_mode==='sponsored'&&price===0;
  if(!complimentary&&(config.billing_mode!=='paid'||price<=0||config.general_available_cents<price))
    return setError('Saldo real insuficiente para pagar la investigación. Necesitas fondos verificados.');
  // Free research must not trigger any wallet confirmation screen.
  if(!complimentary&&!researchConfirm){setResearchConfirm(true);return;}
  setResearchConfirm(false);
  setBusy(true);setError('');
  if(!keyRef.current)keyRef.current=crypto.randomUUID();
  try{
   const r=await fetch('/api/realizo/ai-premium',{
    method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...product,template_id:template?.id||null,
      template_actor:templateActor,template_setting:templateSetting,template_change_request:templateChangeRequest,
      primary_asset_id:image.id,request_key:keyRef.current,
      max_price_cents:price,pricing_version:config.pricing_version}),
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok && [502,503,504].includes(r.status)){
     if(await recoverStartedResearch(keyRef.current))return;
     throw Error('No se pudo confirmar el inicio. Conservamos la misma solicitud para evitar cobros duplicados; inténtalo nuevamente desde esta pantalla.');
   }
   if(!r.ok)throw Error(json.error==='ai_premium_daily_limit'?
     'Has alcanzado el límite de investigaciones gratuitas disponible por ahora.':
     json.error==='insufficient_general_funds'||json.error==='verified_real_topup_required'?
     'Necesitas saldo de una recarga real verificada.':
     json.error==='price_changed_confirm_again'?'El precio cambió. Actualiza y confírmalo nuevamente.':
     json.error==='invalid_video_configuration'?'El modelo o duración elegidos ya no están disponibles. Selecciona otra combinación.':
     json.error==='research_background_unavailable'?'El motor de investigación está temporalmente indisponible. No se reservó ningún crédito.':
     'No se pudo iniciar la investigación: '+(json.error||r.status));
   setProject(json);
   onWalletRefresh?.();
  }catch(e){setError(e.message)}
  finally{setBusy(false)}
 };
 // The customer already chose the model, duration, cast and audio.
 // Submit only the concept index; the server owns all prior choices.
 const approve=async()=>{
  setBusy(true);setError('');setGenerationFailed(false);
  try{
   const r=await fetch('/api/realizo/ai-premium/'+encodeURIComponent(project.id)+'/approve',{
    method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({index:selection,...(hasSpokenAudio?{speech:activeSpeech}:{})}),
   });
   const json=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(
    json.error==='ugc_speech_timing_invalid'||json.error==='ugc_speech_quality_invalid'?
      'El guion de este concepto no se ajusta a la duración. Elige otro concepto; no se cobra otra investigación.':
    json.error==='image_expired_reupload'?
      'La fotografía original caducó y debe cargarse otra vez.':
    json.error==='invalid_video_configuration'?
      'El modelo o duración que seleccionaste ya no están disponibles.':
    'No se pudo aprobar: '+(json.error||r.status));
   const prepared=json.ready_for_editor;
   if(!prepared?.ready_for_generation)throw Error('El proyecto no contiene una configuración de video válida.');
   setProject(json);
   if(typeof onWalletGenerate!=='function')throw Error('El servicio de generación no está disponible.');
   const result=await onWalletGenerate(prepared.ready_for_generation,{
    creativeContext:{project_id:prepared.project_id,cast_mode:prepared.cast_mode,
      audio_mode:prepared.audio_mode,creative_style:prepared.creative_style},
    onSubmitted:id=>{setJobId(id);onWalletRefresh?.()},
   });
   if(result?.job_id){setCompleted(true);onWalletRefresh?.();
     onGenerationComplete?.(result);}
   else throw Error('La generación no devolvió un identificador de video.');
  }catch(e){setError(e.message);setGenerationFailed(true)}
  finally{setBusy(false)}
 };
 const concepts=project?.concepts||[];
 const chosenConcept=concepts[selection];
 const activeStyle=project?.creative_style==='auto'?chosenConcept?.creative_style:project?.creative_style;
 const hasSpokenAudio=Boolean(chosenConcept)&&(!['premium','cinematic'].includes(activeStyle)||project?.audio_mode!=='no_voice');
 const activeSpeech=Object.hasOwn(speechEdits,selection)?speechEdits[selection]:String(chosenConcept?.spoken_script||chosenConcept?.script||'');
 const videoOptions=config?.video_options||[];
 const selectedModel=videoOptions.find(m=>m.id===product.video_model_id);
 const availableDurations=selectedModel?.durations||[];
 const videoSettingsOptions=selectedModel?.settings_by_duration?.[product.video_duration_seconds]||selectedModel||{};
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
  if(template)return; // master model cannot be changed
   if(!next)return;
   setProduct(prev=>({
    ...prev,video_model_id:next.id,
    video_duration_seconds:preferredDuration(next,prev.video_duration_seconds),
    video_aspect_ratio:next.aspect_ratios?.[0]||'',video_resolution:next.resolutions?.[0]||'',video_quality:next.qualities?.[0]||'',
   }));
   keyRef.current=null;
 };
 const ready=concepts.length===3 && ['ready','needs_review','approved'].includes(project?.status);
 return <div className="realizo-premium-skin max-w-[1160px] mx-auto space-y-5">
  <div className="rounded-[25px] bg-gradient-to-r from-[#38244E] to-[#6D47AE] p-6 sm:p-8 text-white">
   <p className="text-xs font-bold tracking-[.19em] uppercase text-[#F8C3C5]">Realizo AI Premium</p>
   <h2 className="text-[27px] sm:text-[36px] font-extrabold mt-2">Tu agencia creativa con IA.</h2>
   <p className="text-sm text-[#EEE2F6] max-w-2xl mt-2 leading-6">
    Sube la foto, describe el producto y elige el mercado. La IA investiga y prepara tres anuncios para que tú decidas.
   </p>
   <p className="mt-4 inline-block rounded-full bg-white/15 px-4 py-2 text-xs font-bold">
    {config?.enabled && config.customer_charge_cents>0?
      'Investigación IA: USD '+(config.customer_charge_cents/100).toFixed(2)+' · Video aparte':
      config?.enabled&&config?.billing_mode==='sponsored'&&config?.customer_charge_cents===0?
      'Investigación IA: Gratis por ahora · Video aparte':
      'Investigación de IA no disponible'}
   </p>
  </div>
  <div className="realizo-premium-progress" aria-label="Proceso de creación">
    <span className={!project?'current':'done'}><i>01</i> Producto y motor</span>
    <i className="realizo-progress-line"/>
    <span className={project&&['ready','needs_review','approved'].includes(project.status)?'current':project?'in-progress':''}><i>02</i> Investigación y conceptos</span>
    <i className="realizo-progress-line"/>
    <span className={project?.status==='approved'?'done':''}><i>03</i> Revisión y generación</span>
   </div>
  {error&&<div role="alert" className="rounded-2xl border border-[#EEB9AB] bg-[#FFF0E9] px-5 py-3 text-sm text-[#914F40]">{error}</div>}
  {template&&!project&&<div className="realizo-v11-template-brief">
   <div><span>CREACIÓN DESDE PLANTILLA</span><h3>{template.name}</h3>
    <p>{template.description} Solo se reemplaza el producto, su uso y el diálogo. Imagen de referencia: no se sube el video maestro.</p></div>
   <div className="realizo-v11-template-beats">{templatePlan(template,Number(product.video_duration_seconds)||template.duration).map(b=>
    <span key={b.key}><b>{b.start}–{b.end}s</b> {b.label}</span>)}</div>
   <div className="realizo-v11-template-options">
    <label>Personaje
     <select value={templateActor} onChange={e=>setTemplateActor(e.target.value)}>
      <option value="hombre">Hombre (original)</option><option value="mujer">Mujer</option>
     </select>
    </label>
    <label>Escenario
     <input value={templateSetting==='auto'?'':templateSetting} onChange={e=>setTemplateSetting(e.target.value||'auto')}
      maxLength={120} placeholder="Baño de casa (original)"/>
    </label>
   </div>
   <label className="block mt-3 text-sm font-bold text-[#F5E8E1]">¿Qué quieres cambiar? (opcional)
    <textarea className="mt-2 w-full rounded-xl border border-[#51464F] bg-[#17161D] p-3 text-white" rows={2}
     maxLength={400} value={templateChangeRequest} onChange={e=>setTemplateChangeRequest(e.target.value)}
     placeholder="Ej. Cambia al hombre por una mujer, conserva todo lo demás."/>
   </label>
  </div>}
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
    <p className="text-xs text-[#86758B]">La fotografía define el aspecto del producto. Puedes seguir personalizando escenas y estilo.</p>
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
       <select className={field+' mt-2'} disabled={Boolean(template)} value={product.angle} onChange={e=>change('angle',e.target.value)}>
        {SALES_ANGLE_CHOICES.map(([v,n])=><option key={v} value={v}>{n}</option>)}
        {template&&!SALES_ANGLE_CHOICES.some(([id])=>id===product.angle)&&
         <option value={product.angle}>Ángulo fijo de la plantilla</option>}
       </select>
     </label>
    </div>
    {product.angle==='custom'&&!template&&
     <label className="block text-sm font-bold">Describe tu ángulo de venta
      <textarea className={field+' mt-2 min-h-[92px]'} value={product.custom_angle}
       maxLength={240} onChange={e=>change('custom_angle',e.target.value)}
       placeholder="Ej. Quiero que el comprador sienta seguridad y atractivo al salir, destacando el aroma sin prometer atraer personas."/>
      <span className="block text-xs font-normal text-[#806D90] mt-1">La IA investigará este enfoque y lo aplicará a los tres conceptos. No modifica el formato, el motor ni la duración.</span>
     </label>}
    <label className="block text-sm font-bold">Idioma de voz y video
     <select className={field+' mt-2'} disabled={Boolean(template)} value={product.video_language} onChange={e=>change('video_language',e.target.value)}>
      {languages.map(([code,name])=><option key={code} value={code}>{name}</option>)}
     </select>
    </label>
    <div className="rounded-2xl border border-[#D8C5EF] bg-[#F9F5FF] p-4 space-y-3">
     <p className="text-sm font-extrabold">3. Configura el video antes de investigar</p>
     <p className="text-xs text-[#765E90]">Elige un estilo y motor. El precio del video se confirmará antes de generarlo.</p>
     <div className="space-y-2">
      <p className="text-sm font-bold">Formato publicitario</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
       {creativeStyles.map(([id,icon,label])=><button type="button" key={id}
        aria-pressed={product.creative_style===id} disabled={Boolean(template)} onClick={()=>change('creative_style',id)}
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

     {(product.creative_style==='premium'||product.creative_style==='cinematic')&&!template&&<div className="space-y-2">
      <p className="text-sm font-bold">¿Quién aparece en el anuncio?</p>
      <div className="grid grid-cols-2 gap-2">
       {[
        ['product_only','📦 Solo producto','Solo envase, textura, luz y cortes de cine. Sin personas.'],
        ['with_people','🎬 Con personas','Modelos en escenas de cine, sin estilo UGC.']
       ].map(([id,label,description])=><button key={id} type="button" aria-pressed={product.cast_mode===id}
        onClick={()=>{setProduct(p=>({...p,cast_mode:id,audio_mode:id==='product_only'&&p.audio_mode==='dialogue'?'no_voice':p.audio_mode}));keyRef.current=null;}} className={'rounded-xl border-2 p-3 text-left '+(product.cast_mode===id?'border-[#7650C6] bg-white':'border-[#E7DEEC] bg-white/60')}>
        <strong className="block text-sm">{label}</strong><span className="block text-xs mt-1">{description}</span>
       </button>)}
      </div>
     </div>}
     {(product.creative_style==='premium'||product.creative_style==='cinematic')&&!template&&<div className="space-y-2">
      <p className="text-sm font-bold">¿Cómo quieres el audio?</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
       {[
        ['no_voice','🎼 Sin voces','Solo música instrumental y sonidos cinematográficos.'],
        ['voiceover','🎙️ Voz en off','Narración profesional, sin locutor visible.'],
        ['dialogue','🗣️ Con diálogo','Actores conversan entre sí, sin hablar al público.']
       ].map(([id,label,description])=><button key={id} type="button"
        disabled={id==='dialogue'&&product.cast_mode==='product_only'}
        aria-pressed={product.audio_mode===id}
        onClick={()=>change('audio_mode',id)}
        className={'rounded-xl border-2 p-3 text-left disabled:opacity-40 '+(product.audio_mode===id?'border-[#7650C6] bg-white':'border-[#E7DEEC] bg-white/60')}>
        <strong className="block text-sm">{label}</strong>
        <span className="block text-xs mt-1">{description}</span>
       </button>)}
      </div>
      {product.cast_mode==='product_only'&&<p className="text-xs text-[#866E94]">El diálogo entre actores requiere «Con personas». La voz en off sí se permite en «Solo producto».</p>}
      <p className="text-xs text-[#866E94]">La generación de voces depende de las capacidades del modelo.</p>
     </div>}
     <div className="grid sm:grid-cols-2 gap-3">
      <label className="block text-sm font-bold">Proveedor
       <select className={field+' mt-2'} disabled={Boolean(template)} value={selectedProvider}
        onChange={e=>chooseVideoModel(preferredVideoModel(
         videoOptions.filter(m=>m.provider===e.target.value)))}>
        {providerOptions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
       </select>
      </label>
      <label className="block text-sm font-bold">Modelo y versión
       <select className={field+' mt-2'} disabled={Boolean(template)} value={selectedFamily}
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
        return <button key={mode} type="button" disabled={Boolean(template)} onClick={()=>chooseVideoModel(preferredVideoModel(
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
       <select className={field+' mt-2 text-sm'} disabled={Boolean(template)} value={product.video_model_id}
        onChange={e=>chooseVideoModel(variantsForMode.find(m=>m.id===e.target.value))}>
        {variantsForMode.map(model=><option key={model.id} value={model.id}>
         {model.variant_label||model.name}
        </option>)}
       </select>
      </label>
     </details>}
     {selectedModel&&<>
      <label className="block text-sm font-bold">Duración disponible
       <select className={field+' mt-2'} disabled={Boolean(template)} value={product.video_duration_seconds}
        onChange={e=>{const duration=Number(e.target.value);const opts=selectedModel.settings_by_duration?.[duration]||{};
         setProduct(p=>({...p,video_duration_seconds:duration,video_aspect_ratio:opts.aspect_ratios?.[0]||'',video_resolution:opts.resolutions?.[0]||'',video_quality:opts.qualities?.[0]||''}));keyRef.current=null;}}>
        {availableDurations.map(n=><option key={n} value={n}>{n} segundos</option>)}
       </select>
      </label>
      <div className="grid sm:grid-cols-3 gap-3">
       {(videoSettingsOptions.aspect_ratios||[]).length>0&&<label className="text-sm font-bold">Formato de pantalla
        <select className={field+' mt-2'} value={product.video_aspect_ratio||videoSettingsOptions.aspect_ratios[0]}
         onChange={e=>change('video_aspect_ratio',e.target.value)}>
         {videoSettingsOptions.aspect_ratios.map(v=><option key={v} value={v}>{v}</option>)}
        </select></label>}
       {(videoSettingsOptions.resolutions||[]).length>0&&<label className="text-sm font-bold">Resolución
        <select className={field+' mt-2'} value={product.video_resolution||videoSettingsOptions.resolutions[0]}
         onChange={e=>change('video_resolution',e.target.value)}>
         {videoSettingsOptions.resolutions.map(v=><option key={v} value={v}>{v}</option>)}
        </select></label>}
       {(videoSettingsOptions.qualities||[]).length>0&&<label className="text-sm font-bold">Calidad
        <select className={field+' mt-2'} value={product.video_quality||videoSettingsOptions.qualities[0]}
         onChange={e=>change('video_quality',e.target.value)}>
         {videoSettingsOptions.qualities.map(v=><option key={v} value={v}>{v}</option>)}
        </select></label>}
      </div>
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
    {template&&<p className="text-xs text-[#C7A28A]">Estilo de la plantilla bloqueado. Puedes cambiar motor y duración según compatibilidad.</p>}
    <p className="text-xs text-[#755F88] rounded-xl bg-[#F8F3FC] p-3">
     {config?.billing_mode==='sponsored'&&config?.customer_charge_cents===0?
      <><strong>Gratis por ahora:</strong> investigación y 3 conceptos de venta. El video se cobra aparte.</>:
      <>Precio fijo: <strong>USD {((config?.customer_charge_cents||0)/100).toFixed(2)}</strong> por investigar y crear 3 conceptos. El video se cobra aparte.</>}
    </p>
    {researchConfirm&&config?.billing_mode==='paid'&&<div role="region" aria-label="Confirmar investigación" className="rounded-2xl border border-[#B9A7D5] bg-white p-4 space-y-3">
      <p className="font-bold text-[#4C3370]">Confirma tu investigación en Realizo</p>
      <p className="text-sm">Se reservarán <strong>USD {((config?.customer_charge_cents||0)/100).toFixed(2)}</strong> de tu billetera. Al entregar los 3 conceptos se aplicará el cargo. La generación del video se cotiza por separado.</p>
      <div className="flex gap-3 flex-wrap">
       <button type="button" disabled={busy} onClick={start} className="rounded-xl bg-[#704CD4] text-white px-5 py-3 font-bold">Confirmar y continuar</button>
       <button type="button" onClick={()=>setResearchConfirm(false)} className="rounded-xl border px-5 py-3">Cancelar</button>
      </div>
     </div>}
    <div className="flex flex-wrap gap-3">
     <button type="button" disabled={busy||researchConfirm||!config?.enabled||!image||!selectedModel||!product.video_duration_seconds}
      onClick={start} className="rounded-2xl bg-[#704CD4] disabled:opacity-45 text-white px-6 py-3 font-bold">
      {busy?'Investigando…':config?.billing_mode==='sponsored'&&config?.customer_charge_cents===0?
       '✦ Investigar gratis':'✦ Investigar y pagar USD '+((config?.customer_charge_cents||0)/100).toFixed(2)}
     </button>
     <button type="button" onClick={onUseAutomatic}
      className="rounded-2xl border border-[#DCCEE9] px-5 py-3 text-[#684C98] font-bold">Modo automático</button>
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
      <p className="text-sm text-[#7D718A] mt-2">REALIZO está identificando cada producto, contrastando fuentes web, revisando sus características y eligiendo los motivos de compra antes de crear los conceptos. Reabrir el proyecto no inicia nuevas consultas ni cobros.</p>
    </div>}
    {project.status==='failed'&&<div className="text-sm text-[#9A6257] space-y-1">
      <p><strong>No se completó la investigación.</strong> {({
       research_web_not_performed:'OpenAI no llegó a consultar internet.',
       research_output_incomplete:'OpenAI terminó sin entregar el informe completo.',
       research_output_token_limit:'OpenAI alcanzó su límite de respuesta antes de completar el informe.',
       research_provider_failed:'El proveedor interrumpió la investigación.',
       unusable_research:'OpenAI devolvió datos que no permiten validar los anuncios.',
       openai_rejected:'El proveedor rechazó la configuración de investigación.',
       openai_rejected_schema:'OpenAI no admitió el formato estructurado configurado.',
       openai_rejected_search:'OpenAI no admitió la herramienta de búsqueda solicitada.',
       openai_rejected_model:'El modelo OpenAI configurado no está disponible o no admite esta operación.',
       openai_rejected_quota:'OpenAI alcanzó un límite de solicitudes. No se capturó el pago.',
       openai_rejected_request:'OpenAI rechazó uno de los parámetros de la investigación.',
       research_launch_unconfirmed:'No se pudo confirmar el inicio; no se volverá a enviar automáticamente.',
      })[project.error]||'No fue posible obtener los tres conceptos válidos.'}</p>
      <p>{project.research_is_complimentary?'Esta investigación fue gratuita; no se realizó ningún cargo.':project.research_payment_status==='released'?
       'La reserva de investigación fue liberada: no se cobró USD 0,49.':
       project.research_payment_status==='reserved'?
       'El cobro está en revisión; no se volverá a intentar automáticamente.':
       'No se capturó ningún cobro de esta investigación.'}</p>
      {project.error==='unusable_research'&&
       <p>REALIZO intentará recuperar la respuesta ya existente al reabrir el proyecto, sin generar otra investigación ni cobrar de nuevo.</p>}
      {['research_output_incomplete','research_output_token_limit'].includes(project.error)&&
       <p>La respuesta quedó incompleta y no puede tratarse como un informe terminado. Puedes iniciar otra investigación; este intento fallido no se cobró.</p>}
     </div>}
    {project.status==='needs_review'&&!ready&&<p className="text-sm text-[#9A6257]">La investigación necesita revisión técnica antes de volver a intentarse. No se volverá a cobrar automáticamente.</p>}
    {ready&&<>
      <p className="text-sm text-[#88778E]">Elige un concepto. Realizo conservará automáticamente todas las opciones que ya seleccionaste.</p>
      <div className="grid sm:grid-cols-3 gap-3">
       {concepts.map((concept,i)=>{
        const visual=visualFor(concept);
        return <button type="button" key={i} aria-pressed={selection===i}
          disabled={busy} onClick={()=>setSelection(i)}
          className={'rounded-2xl text-left border-2 overflow-hidden transition '+(selection===i?'border-[#8054C9] shadow-md':'border-[#E9DFEC] hover:border-[#B89DE4]')}>
         <div className="h-[110px] bg-gradient-to-br from-[#E6DBF6] via-[#F8E8EA] to-[#F9EDD7] flex items-center justify-center">
          <span className="text-5xl" aria-hidden="true">{visual.icon}</span>
         </div>
         <div className="p-4 space-y-2">
          <p className="font-bold text-sm">{concept.name}</p>
          <p className="text-xs text-[#7D698A]">“{concept.hook}”</p>
          {!!concept.buyer_motive&&<p className="text-xs text-[#756581]">Motivo: {concept.buyer_motive}</p>}
          <p className="text-xs font-bold text-[#7551BD]">{selection===i?'✓ Elegido':'Elegir concepto'}</p>
         </div>
        </button>;
       })}
      </div>
      {hasSpokenAudio&&<label className="block text-sm font-bold">Guion hablado del concepto seleccionado
       <textarea className={field+' mt-2 min-h-[100px] text-sm'} aria-label="Editar guion de este concepto"
        value={activeSpeech} maxLength={3200} disabled={busy}
        onChange={e=>setSpeechEdits(d=>({...d,[selection]:e.target.value}))}/>
       <span className="block text-xs font-normal text-[#806D90] mt-1">Puedes cambiar las frases de este concepto. Cada propuesta conserva su propio guion, sin repetir la investigación.</span>
      </label>}
      {jobId&&<p role="status" className="text-sm text-[#6B4B8C]">Video registrado en Mis creaciones. Solicitud: {jobId}. {completed?'Generación completada.':generationFailed?'El proveedor no completó el video; revisa el motivo indicado arriba.':'El proveedor está procesando el video.'}</p>}
      {jobId&&<button type="button" onClick={onViewCreations} className="text-sm font-bold text-[#6D48CB] underline">Ver Mis creaciones</button>}
      <button type="button" onClick={approve} disabled={busy||completed}
       className="rounded-2xl bg-[#6D48CB] text-white font-bold py-3.5 px-6 disabled:opacity-50">
       {busy?'Preparando o generando…':'Aprobar concepto y generar'}
      </button>
      <p className="text-xs text-[#86788F]">Al aprobar autorizas el concepto y sus afirmaciones comerciales. Confirmarás el precio aquí mismo, sin pasar por otro editor. No se cobrarán créditos sin tu confirmación.</p>
    </>}
  </section>}
 </div>;
}
