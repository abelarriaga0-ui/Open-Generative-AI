'use client';
import {useEffect, useMemo, useState} from 'react';
import {optimizeImage} from '@/lib/realizo-creative/optimize-image';
import {normalizeHyperrealProBrief, planHyperrealProScenes} from '@/lib/realizo-creative/hyperreal-pro';

const initial = {
  product_name: '', description: '', audience: '', angle: '', actor: '',
  location: '', cta: '', spoken_script: '',
  duration: 30, format: '9:16', speak: true
};
const money = cents => new Intl.NumberFormat('es-EC', {style:'currency',currency:'USD'}).format((cents||0)/100);
const field = 'block w-full rounded-2xl border border-[#E4DAEB] bg-white p-3.5 text-sm text-[#30203D] outline-none focus:border-[#805BC1]';
const label = 'block text-[13px] font-bold text-[#574367] mb-2';
const errorText = {
  invalid_media_reference: 'La foto de referencia caducó. Vuelve a subirla.',
  invalid_video_configuration: 'El motor no admite esta duración o calidad. Selecciona otra opción.',
  reference_image_model_required: 'Elige un motor de referencias visuales, no uno que solo anime el primer fotograma.',
  not_authenticated: 'Inicia sesión antes de generar.',
};
export default function RealizoHyperrealPro({guest=false, onWalletGenerate, onGenerationComplete, onWalletRefresh, onViewCreations}) {
  const [brief,setBrief] = useState(initial);
  const [photo,setPhoto] = useState(null);
  const [preview,setPreview] = useState('');
  const [config,setConfig] = useState(null);
  const [modelId,setModelId] = useState('');
  const [prepared,setPrepared] = useState(null);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [phase,setPhase] = useState('');
  const [submittedJob,setSubmittedJob] = useState('');
  const [completed,setCompleted] = useState(null);

  useEffect(()=>{
    fetch('/api/realizo/ai-premium',{credentials:'same-origin',cache:'no-store'})
      .then(async response=>{
        const data=await response.json().catch(()=>({}));
        if(!response.ok)throw Error(data.error||'No se pudo cargar el catálogo');
        setConfig(data);
      }).catch(e=>setError(e.message));
  },[]);
  useEffect(()=>{
    if(!photo){setPreview('');return;}
    const url=URL.createObjectURL(photo);
    setPreview(url);
    return ()=>URL.revokeObjectURL(url);
  },[photo]);
  const compatible = useMemo(
    ()=> (config?.video_options||[]).filter(m=>m.image_role==='product_reference' && m.durations?.includes(Number(brief.duration))),
    [config,brief.duration]
  );
  useEffect(()=>{
    if(!compatible.some(m=>m.id===modelId))
      setModelId(compatible.find(m=>m.id==='seedance-2.5-intl-omni-reference')?.id||compatible[0]?.id||'');
  },[compatible,modelId]);
  const chosen = compatible.find(m=>m.id===modelId);
  const settings = chosen?.settings_by_duration?.[brief.duration]||chosen||{};
  const change=(key,value)=>{setBrief(p=>({...p,[key]:value}));setPrepared(null);setCompleted(null);};
  const btn='rounded-full px-6 py-3 font-extrabold text-[13px] transition disabled:opacity-50';
  const scenes = prepared?.scenes||[];

  const plan=()=>{
    setError('');
    try {
      const validated=normalizeHyperrealProBrief(brief);
      if(!photo)throw Error('Sube la fotografía original del producto.');
      if(!chosen)throw Error('No hay un motor de referencia visual compatible con los segundos seleccionados.');
      setPrepared({scenes:planHyperrealProScenes(validated),brief:validated});
    }catch(e){setError(e.message)}
  };
  const generate=async()=>{
    if(guest){window.location.assign('/login');return;}
    if(busy || !prepared?.brief || !photo || !chosen)return;
    setBusy(true);setError('');setCompleted(null);setSubmittedJob('');
    try{
      setPhase('Preparando la foto del producto...');
      const image=await optimizeImage(photo);
      const upload=new FormData();
      upload.append('image',image,'referencia-producto.webp');
      const sent=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body:upload});
      const item=await sent.json().catch(()=>({}));
      if(!sent.ok||!item.url)throw Error(item.error||'No se pudo subir la foto de referencia.');

      setPhase('Preparando el storyboard hiperrealista...');
      const r=await fetch('/api/realizo/hyperreal/prepare',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          brief:prepared.brief, image_url:item.url, model_id:modelId,
          ...(settings?.aspect_ratios?.includes(brief.format)?{aspect_ratio:brief.format}:{}),
        })
      });
      const storyboard=await r.json().catch(()=>({}));
      if(!r.ok||!storyboard.params)throw Error(errorText[storyboard.error]||storyboard.error||'No se pudo preparar el video.');
      if(typeof onWalletGenerate!=='function')throw Error('El generador de video está temporalmente indisponible.');

      setPhase('Consultando el costo exacto. Debes confirmar antes de pagar...');
      const result=await onWalletGenerate(storyboard.params,{
        onSubmitted:id=>{setSubmittedJob(id);setPhase('MuAPI está generando tu video. Puedes encontrar el trabajo en Mis creaciones.');onWalletRefresh?.()}
      });
      setCompleted(result);
      onWalletRefresh?.();
      onGenerationComplete?.(result);
    }catch(e){setError(e?.message||'No se pudo generar.');}
    finally{setBusy(false);setPhase('')}
  };

  return <section className="max-w-[1200px] mx-auto space-y-6">
    <header className="rounded-[30px] bg-gradient-to-br from-[#2D1A47] via-[#4C3473] to-[#7553AD] p-7 sm:p-10 text-white shadow-sm">
      <span className="inline-flex rounded-full bg-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.2em]">Módulo separado · Hiperrealista PRO</span>
      <h1 className="mt-4 text-[30px] sm:text-[43px] font-extrabold tracking-tight">Anuncios que parecen grabados de verdad.</h1>
      <p className="mt-3 max-w-[770px] text-sm leading-7 text-[#EDE4F9]">Crea un video publicitario con la misma persona, el mismo producto y un plan de múltiples tomas. Puedes incluir diálogo a cámara y acciones naturales sin modificar los flujos de Realizo AI Premium.</p>
    </header>

    <div className="rounded-2xl border border-[#EADDF4] bg-[#FBF8FF] px-5 py-4 text-[13px] leading-6 text-[#634C79]">
      <strong>Estado de esta versión:</strong> genera un video con instrucciones de varias tomas usando una fotografía como referencia de identidad. La generación automática de una imagen distinta por escena, el montaje de varios clips y la ejecución integral en segundo plano aún no están habilitados. El realismo, los cortes y la voz dependen del modelo elegido y no están garantizados.
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
      <form onSubmit={e=>{e.preventDefault();plan()}} className="space-y-5 rounded-[26px] border border-[#EDE5EF] bg-white p-5 sm:p-7 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-[#352442]">1. Tu producto y tu idea</h2>
          <p className="text-[13px] mt-1 text-[#756681]">El producto real define la marca, el envase, la etiqueta y los colores.</p>
        </div>
        <label className={label}>Foto original del producto
          <input type="file" accept="image/jpeg,image/png,image/webp" className={field+' mt-2'} onChange={e=>{
            const file=e.target.files?.[0]||null;
            if(file && (!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)){setError('Sube una foto JPG, PNG o WebP de hasta 8 MB.');return;}
            setPhoto(file);setPrepared(null);setError('');
          }}/>
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className={label}>Nombre del producto
            <input required maxLength={90} value={brief.product_name} onChange={e=>change('product_name',e.target.value)} placeholder="Ej. Champú capilar" className={field+' mt-2'}/>
          </label>
          <label className={label}>Público objetivo
            <input maxLength={150} value={brief.audience} onChange={e=>change('audience',e.target.value)} placeholder="Ej. Hombres adultos en Ecuador" className={field+' mt-2'}/>
          </label>
        </div>
        <label className={label}>Descripción y atributos confirmados
          <textarea required rows={3} maxLength={400} value={brief.description} onChange={e=>change('description',e.target.value)} className={field+' mt-2'} placeholder="Qué es, cómo se usa y qué puedes afirmar realmente de este producto."/>
        </label>
        <label className={label}>Ángulo de venta
          <textarea rows={2} maxLength={250} value={brief.angle} onChange={e=>change('angle',e.target.value)} className={field+' mt-2'} placeholder="Ej. Rutina personal con aspecto más cuidado; evita promesas no verificadas."/>
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className={label}>Personaje constante
            <input maxLength={220} value={brief.actor} onChange={e=>change('actor',e.target.value)} className={field+' mt-2'} placeholder="Adulto, apariencia, ropa..."/>
          </label>
          <label className={label}>Lugar y luz
            <input maxLength={170} value={brief.location} onChange={e=>change('location',e.target.value)} className={field+' mt-2'} placeholder="Baño de casa con luz de ventana"/>
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className={label}>Duración
            <select value={brief.duration} onChange={e=>change('duration',Number(e.target.value))} className={field+' mt-2'}>
              {[15,30,45].map(n=><option key={n} value={n}>{n} segundos</option>)}
            </select>
          </label>
          <label className={label}>Formato
            <select value={brief.format} onChange={e=>change('format',e.target.value)} className={field+' mt-2'}>
              <option value="9:16">9:16 · Reels / TikTok</option>
              <option value="16:9">16:9 · Horizontal</option>
            </select>
          </label>
          <label className={label}>Voz a cámara
            <select value={brief.speak?'yes':'no'} onChange={e=>change('speak',e.target.value==='yes')} className={field+' mt-2'}>
              <option value="yes">Sí, hablar a cámara</option>
              <option value="no">No, solo actividades</option>
            </select>
          </label>
        </div>
        {brief.speak&&<label className={label}>Guion hablado exacto (opcional)
          <textarea rows={3} maxLength={900} value={brief.spoken_script} onChange={e=>change('spoken_script',e.target.value)} className={field+' mt-2'} placeholder="Si lo dejas vacío, se pedirá al modelo que formule un diálogo breve basado únicamente en tus datos. La voz depende del motor."/>
        </label>}
        <label className={label}>Llamado a la acción
          <input maxLength={100} value={brief.cta} onChange={e=>change('cta',e.target.value)} className={field+' mt-2'} placeholder="Escríbenos para conocer más"/>
        </label>
        <div className="rounded-2xl bg-[#F8F4FC] p-4 space-y-3">
          <p className="font-extrabold text-[13px] text-[#503B71]">2. Motor que conserva la foto como referencia</p>
          <select value={modelId} onChange={e=>{setModelId(e.target.value);setPrepared(null)}} className={field} disabled={!compatible.length}>
            {!compatible.length?<option value="">Sin motores compatibles para {brief.duration} s</option>:
              compatible.map(m=><option key={m.id} value={m.id}>{m.family} · {m.name}</option>)}
          </select>
          <p className="text-xs leading-5 text-[#806B8B]">Solo se listan los motores que declaran soporte para referencias y para la duración elegida. La disponibilidad y el costo final se verifican antes del cobro.</p>
        </div>
        <button className={btn+' bg-[#6F49B0] text-white w-full'} type="submit" disabled={busy||!photo||!chosen}>Preparar las escenas sin costo</button>
      </form>

      <div className="space-y-5">
        <section className="rounded-[26px] border border-[#EDE5EF] bg-white p-5 sm:p-7 shadow-sm">
          <h2 className="text-xl font-extrabold text-[#352442]">3. Continuidad visual</h2>
          <p className="text-[13px] text-[#7B6983] mt-1">Cada toma seguirá el mismo rostro, ropa, producto y lugar.</p>
          <div className="mt-4 rounded-2xl bg-[#F6F1FA] min-h-[190px] flex items-center justify-center overflow-hidden">
            {preview?<img src={preview} alt="Referencia original del producto" className="max-h-[260px] object-contain"/>:
              <p className="px-6 text-center text-sm text-[#9D8FA5]">Tu fotografía aparecerá aquí</p>}
          </div>
          {scenes.length>0?<div className="space-y-3 mt-5">
            <h3 className="font-bold text-[#594074] text-sm">{scenes.length} tomas planificadas · {brief.duration} segundos</h3>
            {scenes.map(scene=><div className="flex gap-3 rounded-2xl border border-[#EEE5F3] p-3" key={scene.number}>
              <span className="shrink-0 grid place-items-center rounded-xl bg-[#EDE2FD] text-[#6E44A2] w-9 h-9 font-bold">{scene.number}</span>
              <div><p className="text-[13px] font-bold text-[#4F3970]">{scene.title} · {scene.start}–{scene.end} s</p>
                <p className="text-xs leading-5 text-[#817187] mt-1">{scene.action}</p></div>
            </div>)}
          </div>:<p className="text-[13px] leading-6 text-[#82738D] mt-5">Completa tus datos y pulsa «Preparar las escenas». No se usarán créditos para esta planificación.</p>}
        </section>
        {prepared&&<section className="rounded-[26px] border border-[#D9C8EE] bg-[#F8F3FF] p-6">
          <h3 className="font-extrabold text-[#50347F] text-lg">4. Generar en Realizo</h3>
          <p className="text-sm leading-6 text-[#6B5684] mt-2">Al continuar, primero se mostrará el <strong>precio exacto del video</strong> según el modelo. Nada se cobra hasta que lo confirmes. Este modo no aplica recargos adicionales fuera de la cotización mostrada.</p>
          <button type="button" onClick={generate} disabled={busy||!chosen}
            className={btn+' w-full mt-4 bg-[#6F49B0] text-white'}>
            {busy?'Procesando...':guest?'Iniciar sesión para generar':'Cotizar y generar video'}
          </button>
          {busy&&<p role="status" className="mt-3 text-xs text-[#745B91]">{phase||'Procesando...'}</p>}
          {submittedJob&&<p className="text-xs text-[#715D87] mt-3">Trabajo registrado: {submittedJob}. Si se cierra la página, revisa su estado en Mis creaciones.</p>}
          {completed?.url&&<a href={completed.url} target="_blank" rel="noopener noreferrer" className="block mt-4 text-sm font-bold underline text-[#6546A6]">Ver video generado</a>}
          <button type="button" onClick={onViewCreations} className="text-xs font-bold underline text-[#6D5290] mt-4">Ir a Mis creaciones</button>
        </section>}
        {error&&<p role="alert" className="rounded-xl border border-[#E9BCC0] bg-[#FFF1F3] text-[#A04454] p-4 text-sm">{error}</p>}
      </div>
    </div>
  </section>;
}
