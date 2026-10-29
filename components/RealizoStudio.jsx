'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { optimizeImage } from '@/lib/realizo-creative/optimize-image';
import { generateWithRealizoWallet } from '@/lib/realizo-creative/wallet-generation';
import { VideoStudio } from 'studio';
import RealizoCreator from '@/components/RealizoCreator';

function Mark() {
  return <svg width="37" height="37" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <defs><linearGradient id="realizo-studio-sign" x1="2" y1="5" x2="54" y2="52">
      <stop stopColor="#FF987B"/><stop offset=".53" stopColor="#F469A6"/><stop offset="1" stopColor="#A279FF"/>
    </linearGradient></defs><rect width="56" height="56" rx="18" fill="url(#realizo-studio-sign)"/>
    <path d="M19 14.5v27l23-13.5L19 14.5Z" fill="#261C3C"/>
    <path d="M21.7 20.2 35 28l-13.3 7.8V20.2Z" fill="#FFF6EF"/>
    <circle cx="43" cy="13" r="4.5" fill="#C6FFCB"/>
  </svg>;
}
function Icon({name,size=20}){
  const paths={
    video:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></>,
    wallet:<><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 9V6a3 3 0 0 1 3-3h12"/><path d="M16 13h5"/></>,
    folder:<><path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3V7Z"/></>,
    sliders:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2" fill="#F7F3EE"/><circle cx="15" cy="17" r="2" fill="#F7F3EE"/></>,
    chevron:<><path d="m8 5 7 7-7 7"/></>,
    exit:<><path d="M9 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h3"/><path d="m13 8 4 4-4 4M8 12h9"/></>,
    arrow:<><path d="M4 12h16m-7-7 7 7-7 7"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.video}</svg>;
}
const usd=c=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((c||0)/100);
const navBase='flex items-center gap-3 px-4 py-3 rounded-2xl transition w-full text-left font-semibold text-[14px]';
export default function RealizoStudio({accountId}){
 const [wallet,setWallet]=useState(null);
 const [billableModelIds,setBillableModelIds]=useState([]);
 const [generationReady,setGenerationReady]=useState(false);
 const [page,setPage]=useState('create');
 const [brief,setBrief]=useState(null);
 const [editorOpen,setEditorOpen]=useState(false);
 const [sidebar,setSidebar]=useState(false);
 const uploadAsset=useCallback(async(file)=>{
    const compressed=await optimizeImage(file);
    const body=new FormData();body.append('image',compressed);
    const r=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body});
    const json=await r.json();
    if(!r.ok||!json.url)throw new Error(json.error||'No se pudo cargar la imagen');
    return json.url;
 },[]);
 useEffect(()=>{
   const controller=new AbortController();
   fetch('/api/wallet',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
     .then(r=>r.ok?r.json():null)
     .then(x=>{setWallet(x?.wallet||null);setBillableModelIds((x?.models||[]).map(m=>m.model_id));setGenerationReady(Boolean(x?.generation_enabled));}).catch(()=>{});
   return ()=>controller.abort();
 },[]);
 const onWalletGenerate=useCallback(params=>generateWithRealizoWallet(params),[]);
 async function exit(){
   try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}
   finally{window.location.assign('/login');}
 }
 function openEditor(){setEditorOpen(true);setPage('create');setSidebar(false)}
 const nav=(id,label,icon,action)=>(
   <button key={id} type="button" onClick={()=>{setPage(id);setSidebar(false);if(action)action();}}
     className={navBase+' '+(page===id?'bg-[#EDE2FB] text-[#6542AB]':'text-[#756782] hover:bg-[#F7F0F7]')}>
      <Icon name={icon}/>{label}{page===id&&<span className="ml-auto h-2 w-2 rounded-full bg-[#E9898F]"/>}
   </button>
 );
 return <main className="min-h-screen bg-[#F7F3EE] text-[#251D37] flex flex-col">
   <header className="h-[76px] shrink-0 bg-[#F7F3EE] border-b border-[#E7DDD8] px-5 sm:px-7 flex items-center justify-between gap-3">
     <Link href="/studio" className="flex items-center gap-2.5 font-extrabold tracking-tight text-[24px]">
       <Mark/>realizo<span className="text-[#EF8B89]">.</span>
     </Link>
     <div className="flex items-center gap-3">
       <Link href="/wallet" className="inline-flex gap-2 items-center rounded-full border border-[#E8DCE1] bg-white text-[#624779] font-bold text-[13px] px-4 py-2.5 hover:border-[#BAA0D3] transition">
         <Icon name="wallet" size={18}/>{wallet?usd(wallet.available_cents):'Mis créditos'}
       </Link>
       <button onClick={()=>setSidebar(b=>!b)} type="button" className="lg:hidden w-10 h-10 grid place-items-center rounded-full bg-[#EDE4F5] text-[#6B5094]" aria-label="Abrir menú"><Icon name="sliders"/></button>
       <button onClick={exit} type="button" className="hidden lg:grid w-10 h-10 place-items-center rounded-full bg-[#EFE9EA] text-[#6E6171] hover:bg-[#E9DDFE]" aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="exit"/></button>
     </div>
   </header>

   <div className="flex flex-1 min-h-[calc(100vh-76px)]">
    <aside className={(sidebar?'block':'hidden')+' lg:block w-full lg:w-[255px] shrink-0 border-r border-[#E9DFDD] bg-[#FFFCF9] p-5 lg:p-6 space-y-4'}>
      <div className="hidden lg:block py-3 mb-5"><p className="text-[11px] tracking-[.18em] uppercase text-[#A58CB9] font-bold mb-2">Mi espacio</p><p className="text-lg font-extrabold leading-snug">Crea algo increíble<span className="text-[#F0928B]">.</span></p></div>
      <nav aria-label="Menú de Realizo" className="space-y-2">
       {nav('create','Crear video','video')}
       {nav('videos','Mis videos','folder')}
       <Link href="/wallet" className={navBase+' text-[#756782] hover:bg-[#F7F0F7]'}><Icon name="wallet"/>Mis créditos<Icon name="chevron" size={14}/></Link>
      </nav>
      <div className="hidden lg:block pt-7"><div className="rounded-[22px] bg-[#302347] text-white p-5 relative overflow-hidden">
        <div className="absolute w-24 h-24 -right-8 -top-10 rounded-full bg-[#D7A2D8]/20"/>
        <p className="text-xs font-semibold text-[#F3BFAC] mb-2">Realizo Studio</p>
        <p className="text-[17px] leading-6 font-extrabold">De la idea al video, en un solo lugar.</p>
        <div className="mt-5 flex gap-1.5 items-center"><span className="h-2 w-2 rounded-full bg-[#BBF2CD]"/><span className="text-[10px] text-[#DCCFEB]">Tu estudio creativo</span></div>
      </div></div>
      <button onClick={exit} className="lg:hidden mt-6 inline-flex items-center gap-2 text-sm text-[#765F88] px-4 py-2"><Icon name="exit"/>Cerrar sesión</button>
    </aside>

    <div className="flex-1 min-w-0 px-4 sm:px-7 lg:px-10 py-8">
     {page==='create'&&<>
      <section className="max-w-[1230px] mx-auto mb-8">
        <p className="uppercase tracking-[.19em] text-[#8A61B5] font-bold text-[11px]">Estudio de creación</p>
        <div className="flex flex-wrap items-center justify-between gap-5 mt-2">
          <div><h1 className="text-[33px] sm:text-[42px] tracking-[-.045em] font-extrabold leading-tight">{editorOpen?'Editor de video':'Convierte tu idea en video'}<span className="text-[#EB8A87]">.</span></h1>
          <p className="mt-2 text-[#8E8197] text-sm">{editorOpen?'Elige el modelo y configura tu generación.':'Dale vida a tu producto en unos pocos pasos.'}</p></div>
          <button type="button" onClick={()=>setEditorOpen(o=>!o)} className="inline-flex gap-2 items-center text-[#6845AB] font-semibold text-sm bg-white rounded-full border border-[#E5D8E4] px-5 py-3 hover:bg-[#F1E9FC]">
            <Icon name={editorOpen?'arrow':'sliders'} size={18}/>{editorOpen?'Volver al producto':'Editor avanzado'}
          </button>
        </div>
      </section>

      {!editorOpen?<RealizoCreator accountId={accountId} onPrepare={setBrief} onOpenAdvanced={openEditor}/>:
       <section className="max-w-[1550px] mx-auto space-y-4">
        {brief&&<div className="rounded-2xl bg-[#E9DDFB] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-[#624496] font-semibold">✓ Producto y ángulo de venta aplicados al editor</span>
          <button type="button" onClick={()=>setEditorOpen(false)} className="text-[#6E4BD2] text-[13px] font-bold hover:underline">Editar concepto</button>
        </div>}
        <div className="rounded-[24px] overflow-hidden border border-[#D6C7E0] shadow-[0_18px_50px_rgba(51,38,83,.12)] h-[min(990px,calc(100vh-195px))] min-h-[680px]">
          <VideoStudio locale="en" apiKey={null} persistenceScope={accountId} preparedBrief={brief}
            realizoBrand previewOnly uploadAsset={uploadAsset}
            onWalletGenerate={onWalletGenerate} generationReady={generationReady}
            billableModelIds={billableModelIds} />
        </div>
        <p className="text-[12px] text-[#9A8B9B]">La generación estará disponible cuando el modelo tenga una tarifa configurada y la billetera pueda cubrirla.</p>
       </section>}
     </>}

     {page==='videos'&&<section className="max-w-[1030px] mx-auto">
       <p className="uppercase tracking-[.19em] text-[#8A61B5] font-bold text-[11px] mb-2">Biblioteca</p>
       <h1 className="text-[36px] tracking-tight font-extrabold">Mis videos<span className="text-[#EB8A87]">.</span></h1>
       <div className="rounded-[25px] bg-white border border-[#E8DEDA] py-20 px-6 text-center mt-7">
        <div className="inline-grid place-items-center w-16 h-16 bg-[#F0E6FB] rounded-2xl text-[#8057BC]"><Icon name="folder" size={29}/></div>
        <h2 className="text-[23px] font-bold mt-5">Tu biblioteca empieza aquí</h2>
        <p className="text-sm text-[#8E8294] mt-2">Tus videos aparecerán cuando completes una generación.</p>
        <button onClick={()=>setPage('create')} className="inline-flex gap-2 items-center mt-6 rounded-2xl bg-[#6E4BD2] text-white font-bold px-5 py-3"><Icon name="video"/>Crear un video</button>
       </div>
      </section>}
    </div>
   </div>
 </main>;
}
