'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildVideoBrief, SALES_ANGLES } from '@/lib/realizo-creative/brief';
import { readProductDocument } from '@/lib/realizo-creative/read-document';
import { optimizeImage } from '@/lib/realizo-creative/optimize-image';

function Icon({name,size=21}) {
 const paths={
  image:<><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8" r="1.5"/><path d="m4 17 6-6 4 4 2-2 5 5"/></>,
  file:<><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v6h5M9 13h6M9 17h6"/></>,
  star:<><path d="m12 2 2.3 7 7.2 2.3-7.2 2.4L12 21l-2.3-7.3L2.5 11.3 9.7 9 12 2Z"/></>,
  pen:<><path d="m14 5 5 5M4 20l4.5-1 11-11a2 2 0 0 0-3-3l-11 11L4 20Z"/></>,
  film:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></>,
  check:<><path d="m4 12 5 5L20 6"/></>,
  plus:<><path d="M12 4v16M4 12h16"/></>,
  arrow:<><path d="M4 12h16m-7-7 7 7-7 7"/></>,
  trash:<><path d="M4 6h16M9 6V4h6v2M7 6l1 14h8l1-14"/></>,
  spark:<><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.star}</svg>;
}
function Field({label,children,help}) {
 return <label className="block space-y-2"><span className="block text-[13px] font-semibold text-[#554466]">{label}</span>{children}{help&&<span className="block text-[11px] text-[#8B7D92]">{help}</span>}</label>;
}
const field='w-full rounded-2xl border border-[#E6DCD7] bg-white px-4 py-3 text-[#281E40] outline-none focus:border-[#8B65D1] focus:ring-2 focus:ring-[#CBB6F2]/30';
const card='rounded-[24px] border border-[#E8DEDA] bg-white shadow-[0_8px_32px_rgba(54,37,70,.035)]';
const productDefault={name:'',description:'',audience:'',objective:'Vender en redes sociales',angle:'auto',tone:'Natural y creíble',cta:''};

export default function RealizoCreator({accountId,onPrepare,onOpenAdvanced}) {
 const [product,setProduct]=useState(productDefault);
 const [documentText,setDocumentText]=useState('');
 const [documentName,setDocumentName]=useState('');
 const [documentSummary,setDocumentSummary]=useState(null);
 const [primary,setPrimary]=useState(null);
 const [references,setReferences]=useState([]);
 const [uploading,setUploading]=useState(false);
 const [documentBusy,setDocumentBusy]=useState(false);
 const [error,setError]=useState('');
 const [prepared,setPrepared]=useState(null);
 const [activeStep,setActiveStep]=useState(1);
 const draftKey='realizo:product-brief:'+accountId;
 const productInput=useRef(null),referenceInput=useRef(null),documentInput=useRef(null);

 useEffect(()=>{
   try{
     const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
     if(draft && typeof draft==='object' && draft.product) {
       setProduct({...productDefault,...draft.product});
       setDocumentText(String(draft.documentText||'').slice(0,16000));
       setDocumentName(String(draft.documentName||''));
     }
   }catch{}
 },[draftKey]);
 useEffect(()=>{
   try{localStorage.setItem(draftKey,JSON.stringify({product,documentText,documentName}));}catch{}
 },[draftKey,product,documentText,documentName]);

 const modify=(key,value)=>{setProduct(p=>({...p,[key]:value}));setPrepared(null)};
 async function upload(file,asPrimary) {
   if(!file) return;
   if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>8*1024*1024) {
     setError('Sube un JPG, PNG o WEBP de máximo 8 MB.');return;
   }
   setError('');setUploading(true);
   try{
     const optimized=await optimizeImage(file);
     const data=new FormData();data.append('image',optimized);
     const result=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body:data});
     const json=await result.json();
     if(!result.ok) throw new Error(json.error==='daily_upload_limit'?'Límite diario de imágenes alcanzado.':
       json.error==='media_not_configured'?'El almacenamiento de imágenes aún no está disponible.':json.error==='image_too_large_for_sandbox'?'La imagen supera el tamaño permitido en pruebas.':'No se pudo guardar la imagen.');
     const attachment={id:json.id,name:file.name,url:json.url};
     if(asPrimary)setPrimary(attachment);
     else setReferences(items=>[...items,attachment].slice(0,3));
     setActiveStep(2);setPrepared(null);
   }catch(e){setError(e.message||'No se pudo cargar la imagen.')}
   finally{setUploading(false)}
 }
 async function attachDocument(file) {
   if(!file)return;
   setError('');setDocumentBusy(true);
   try{
     const txt=await readProductDocument(file);
     setDocumentText(txt);
     setDocumentName(file.name);
     setDocumentSummary(txt.trim().length);
     setPrepared(null);
     setActiveStep(2);
   }catch(e){setError(e.message||'No se pudo leer el archivo')}
   finally{setDocumentBusy(false)}
 }
 const summary=useMemo(()=>buildVideoBrief({...product,documentText,references:(primary?1:0)+references.length}),[product,documentText,primary,references]);
 const prepare=()=>{
    if(!primary&&!product.description.trim()&&!documentText.trim()){
      setError('Añade una imagen del producto o una descripción para empezar.');setActiveStep(1);return;
    }
    setError('');
    const data={...summary,images:[primary?.url,...references.map(a=>a.url)].filter(Boolean),
      revision:crypto.randomUUID(),productName:product.name};
    setPrepared(data);setActiveStep(3);onPrepare(data);
 };
 const options=[{n:1,name:'Producto',icon:'image'},{n:2,name:'Enfoque',icon:'spark'},{n:3,name:'Preparar',icon:'film'}];
 const hasImages=(primary?1:0)+references.length;
 return <div className="realizo-creator-skin w-full max-w-[1230px] mx-auto">
  <div className="flex flex-wrap items-center gap-2 mb-7" aria-label="Pasos para crear video">
   {options.map(o=><button key={o.n} type="button" onClick={()=>setActiveStep(o.n)}
      className={'inline-flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition '+(activeStep===o.n?'bg-[#6F4ED0] text-white':'bg-white text-[#756685] border border-[#E6DBE1] hover:border-[#BBA5D8]')}>
     <span className={'inline-flex items-center justify-center rounded-full h-6 w-6 '+(activeStep===o.n?'bg-white/20':'bg-[#F0E6FB] text-[#7352B1]')}>{o.n}</span>{o.name}</button>)}
  </div>
  {error&&<div role="alert" className="mb-5 bg-[#FFF0E6] border border-[#E7B99F] text-[#985141] rounded-2xl px-4 py-3 text-[13px]">{error}</div>}

  {activeStep===1&&<div className="grid lg:grid-cols-[1.2fr_.8fr] gap-6">
    <section className={card+' p-6 sm:p-8 space-y-6'}>
      <div><h2 className="text-[23px] font-extrabold tracking-tight">Tu producto</h2><p className="text-sm text-[#8A7F92] mt-1">Empieza con lo que quieres mostrar.</p></div>
      <div className="grid sm:grid-cols-2 gap-4">
       <button type="button" disabled={uploading} onClick={()=>productInput.current?.click()}
        className="min-h-[190px] rounded-[22px] border-2 border-dashed border-[#C9B4E7] bg-[#F8F4FD] hover:bg-[#F2EBFB] flex flex-col items-center justify-center p-4 gap-3 disabled:opacity-50 overflow-hidden">
         {primary?<><img alt="Producto principal" src={primary.url} className="h-[115px] w-full object-contain rounded-xl"/><span className="text-xs text-[#66498A] font-semibold">Cambiar producto</span></>:
           <><span className="rounded-2xl bg-[#E6D9F8] text-[#7552B9] p-3"><Icon name="image" size={27}/></span>
           <span className="text-sm font-bold text-[#49365B]">Imagen del producto</span>
           <span className="text-[11px] text-[#8D7D99]">JPG, PNG o WEBP</span></>}
       </button>
       <button type="button" disabled={uploading||references.length>=3} onClick={()=>referenceInput.current?.click()}
        className="min-h-[190px] rounded-[22px] border-2 border-dashed border-[#F3C0B1] bg-[#FFF8F4] hover:bg-[#FFF1EB] flex flex-col items-center justify-center p-4 gap-3 disabled:opacity-50">
        <span className="rounded-2xl bg-[#FFE2D8] text-[#D66E69] p-3"><Icon name="plus" size={27}/></span>
        <span className="text-sm font-bold text-[#49365B]">Referencias visuales</span>
        <span className="text-[11px] text-[#8D7D99]">{references.length} de 3 imágenes</span>
       </button>
      </div>
      {uploading&&<p className="text-xs text-[#7654A6]" role="status">Guardando imagen de forma segura…</p>}
      {references.length>0&&<div className="flex flex-wrap gap-3">
        {references.map(item=><div key={item.id} className="relative w-20 h-20 bg-[#F4EFF0] rounded-xl border border-[#E9DDE3] overflow-hidden">
          <img src={item.url} alt="Referencia visual" className="w-full h-full object-cover"/>
          <button type="button" onClick={()=>setReferences(a=>a.filter(v=>v.id!==item.id))}
             className="absolute right-1 top-1 bg-white/90 rounded-full p-1 text-[#B55166]" aria-label="Quitar referencia"><Icon name="trash" size={14}/></button>
        </div>)}
      </div>}
      <input ref={productInput} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e=>{upload(e.target.files?.[0],true);e.target.value='';}}/>
      <input ref={referenceInput} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={e=>{upload(e.target.files?.[0],false);e.target.value='';}}/>
      <Field label="Nombre del producto"><input className={field} placeholder="Ej. Serum para el cuero cabelludo" value={product.name} maxLength={150} onChange={e=>modify('name',e.target.value)}/></Field>
      <Field label="¿Qué hace?"><textarea className={field+' min-h-[115px] resize-y'} placeholder="Describe el producto en pocas palabras…" value={product.description} maxLength={1600} onChange={e=>modify('description',e.target.value)}/></Field>
      <button type="button" onClick={()=>setActiveStep(2)} className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#6E4BD2] hover:bg-[#5E3BC4] text-white font-bold">Continuar <Icon name="arrow"/></button>
    </section>
    <aside className={card+' p-6 sm:p-8 space-y-5 self-start'}>
      <div className="inline-flex p-3 rounded-2xl bg-[#FFE7DF] text-[#B96E6C]"><Icon name="file" size={26}/></div>
      <div><h2 className="font-extrabold text-[22px] tracking-tight">Ficha del producto</h2><p className="text-[13px] text-[#817489] mt-2">Añade los datos del producto para que el guion sea más preciso.</p></div>
      <button type="button" onClick={()=>documentInput.current?.click()} disabled={documentBusy}
        className="w-full rounded-2xl bg-[#F7F2FC] border border-[#E6D5EF] text-[#6E4BD2] font-semibold text-sm p-4 hover:bg-[#F0E7FA]">
        <span className="inline-flex gap-2 items-center justify-center"><Icon name="plus" size={19}/>{documentBusy?'Leyendo archivo…':documentName?'Cambiar documento':'Subir Word, PDF o TXT'}</span>
      </button>
      <input ref={documentInput} type="file" accept=".docx,.pdf,.txt" className="hidden"
        onChange={e=>{attachDocument(e.target.files?.[0]);e.target.value='';}}/>
      {documentName&&<div className="rounded-xl bg-[#F8F3ED] p-3 flex items-center gap-2 text-[13px]"><Icon name="check"/><span className="truncate flex-1">{documentName}</span>
        <button type="button" aria-label="Quitar documento" onClick={()=>{setDocumentName('');setDocumentText('');setDocumentSummary(null)}}><Icon name="trash" size={16}/></button></div>}
      {documentText&&<p className="text-xs text-[#806B91]">Texto extraído: {(documentSummary||documentText.length).toLocaleString('es-EC')} caracteres.</p>}
      <div className="border-t border-[#EEE4E3] pt-5 space-y-2"><h3 className="text-sm font-bold">Enfoque en el producto</h3><p className="text-[13px] leading-6 text-[#82748C]">La imagen principal define el producto. Las referencias ayudan a definir la escena, sin reemplazar su apariencia.</p></div>
    </aside>
  </div>}

  {activeStep===2&&<div className="grid lg:grid-cols-[1fr_.88fr] gap-6">
    <section className={card+' p-6 sm:p-8 space-y-6'}>
      <div><h2 className="text-[23px] font-extrabold tracking-tight">¿Cómo quieres venderlo?</h2><p className="text-sm text-[#8A7F92] mt-1">Selecciona el enfoque del video.</p></div>
      <div className="grid sm:grid-cols-2 gap-3">
       {SALES_ANGLES.map(x=><button key={x.id} type="button" onClick={()=>modify('angle',x.id)}
          className={'rounded-2xl border text-left px-4 py-3.5 text-[13px] font-semibold flex items-center gap-3 transition '+(product.angle===x.id?'border-[#8155CA] bg-[#F0E7FC] text-[#6339A7]':'border-[#EBE2E2] bg-white text-[#5D4D6B] hover:border-[#CBB9DF]')}>
           <Icon name={x.id==='auto'?'spark':'check'} size={17}/>{x.name}</button>)}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Objetivo"><select className={field} value={product.objective} onChange={e=>modify('objective',e.target.value)}>
          {['Vender en redes sociales','Presentar el producto','Crear un anuncio UGC','Mostrar cómo funciona','Branding'].map(x=><option key={x}>{x}</option>)}
        </select></Field>
        <Field label="Estilo"><select className={field} value={product.tone} onChange={e=>modify('tone',e.target.value)}>
          {['Natural y creíble','Casero con teléfono','Cinematográfico','Premium y elegante','Dinámico para redes','Minimalista'].map(x=><option key={x}>{x}</option>)}
        </select></Field>
        <Field label="Público objetivo"><input className={field} maxLength={200} value={product.audience} placeholder="Ej. Personas de 25 a 45 años" onChange={e=>modify('audience',e.target.value)}/></Field>
        <Field label="Llamado a la acción"><input className={field} maxLength={160} value={product.cta} placeholder="Ej. Descúbrelo hoy" onChange={e=>modify('cta',e.target.value)}/></Field>
      </div>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={()=>setActiveStep(1)} className="px-6 py-3 rounded-2xl border border-[#E4D9E3] font-semibold">Atrás</button>
      <button type="button" onClick={prepare} className="inline-flex gap-2 items-center px-6 py-3 rounded-2xl bg-[#6E4BD2] text-white font-bold hover:bg-[#5E3BC4]"><Icon name="spark"/> Preparar video</button></div>
    </section>
    <aside className={card+' p-6 sm:p-8 self-start space-y-4'}>
      <div className="p-3 inline-flex rounded-2xl bg-[#E7F9E9] text-[#41865A]"><Icon name="spark" size={24}/></div>
      <h2 className="font-extrabold text-[22px]">Vista previa del concepto</h2>
      <p className="text-sm text-[#7C6E86]">Ángulo sugerido: <strong className="text-[#6140A3]">{SALES_ANGLES.find(x=>x.id===summary.angle)?.name||'Demostración'}</strong></p>
      <div className="bg-[#FAF7F2] border border-[#EAE0DE] p-4 rounded-2xl space-y-3 max-h-[370px] overflow-auto">
       {summary.highlights.length>0?summary.highlights.slice(0,5).map((x,i)=><p key={i} className="text-[13px] text-[#544867]">• {x}</p>):
        <p className="text-sm text-[#8F8097]">El enfoque se adapta al contenido de tu producto.</p>}
      </div>
    </aside>
  </div>}

  {activeStep===3&&<section className={card+' p-6 sm:p-8 space-y-6'}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="inline-flex gap-2 items-center text-[#7657B2] text-[12px] font-bold tracking-wide uppercase"><Icon name="check" size={18}/> Concepto preparado</p>
        <h2 className="mt-2 text-[26px] font-extrabold tracking-tight">Tu video empieza aquí.</h2>
        <p className="text-[#8D7D95] mt-1 text-sm">Revisa las instrucciones y continúa con el editor de Realizo.</p>
      </div>
      <button onClick={()=>setActiveStep(2)} className="rounded-xl border border-[#E6DDE1] px-4 py-2 text-sm font-semibold inline-flex gap-2 items-center"><Icon name="pen" size={16}/> Ajustar</button>
    </div>
    <div className="grid lg:grid-cols-[1fr_.8fr] gap-5">
      <div className="realizo-brief-review">
        <div className="realizo-review-symbol">✦</div>
        <h3>Brief preparado para tu anuncio</h3>
        <p>Producto, enfoque y referencias están listos. En el editor podrás elegir el motor y ver el precio antes de generar.</p>
        <details className="realizo-tech-details">
          <summary>Ver o editar instrucciones técnicas</summary>
          <Field label="Prompt editable"><textarea className={field+' min-h-[235px] text-[13px] leading-6 font-mono resize-y mt-3'}
             value={prepared?.prompt||summary.prompt} onChange={e=>setPrepared(p=>({...p,prompt:e.target.value}))}/></Field>
        </details>
      </div>
      <div className="space-y-4">
       <div className="bg-[#F7F3EE] rounded-2xl p-5 space-y-3">
         <p className="text-xs text-[#796888] font-semibold">Resumen</p>
         <p className="font-extrabold text-lg">{product.name||'Mi producto'}</p>
         <p className="text-sm text-[#816D90]">Ángulo: {SALES_ANGLES.find(x=>x.id===summary.angle)?.name}</p>
         <p className="text-sm text-[#816D90]">Imágenes listas: {hasImages}</p>
         <p className="text-sm text-[#816D90]">{documentName?'Ficha: '+documentName:'Sin documento adjunto'}</p>
       </div>
       <button type="button" onClick={()=>{
         const next={...(prepared||{}),prompt:prepared?.prompt||summary.prompt,images:[primary?.url,...references.map(x=>x.url)].filter(Boolean),revision:crypto.randomUUID()};
         setPrepared(next);onPrepare(next);onOpenAdvanced();
       }} className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 bg-[#6E4BD2] hover:bg-[#5E3BC4] rounded-2xl text-white font-bold"><Icon name="film"/> Abrir editor de video <Icon name="arrow"/></button>
       <p className="text-[12px] text-[#8A7C91]">El modelo, la duración y el formato se configuran en el editor.</p>
      </div>
    </div>
  </section>}
 </div>;
}
