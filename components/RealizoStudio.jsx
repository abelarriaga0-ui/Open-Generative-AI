'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { optimizeImage } from '@/lib/realizo-creative/optimize-image';
import { generateWithRealizoWallet } from '@/lib/realizo-creative/wallet-generation';
import { VideoStudio } from 'studio';
import RealizoCreator from '@/components/RealizoCreator';
import RealizoPremium from '@/components/RealizoPremium';
import RealizoVisualGallery from '@/components/RealizoVisualGallery';

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
 const [pilotAvailable,setPilotAvailable]=useState(false);
 const [pilotPrice,setPilotPrice]=useState(null);
 const [jobs,setJobs]=useState([]);
 const [jobsLoading,setJobsLoading]=useState(false);
 const [premiumProjects,setPremiumProjects]=useState([]);
 const [page,setPage]=useState('home');
 const [formatPreset,setFormatPreset]=useState('ugc');
 const [brief,setBrief]=useState(null);
 const [editorOpen,setEditorOpen]=useState(false);
 const [creatorMode,setCreatorMode]=useState('automatic');
 const [resumeProjectId,setResumeProjectId]=useState(null);
 const [createKey,setCreateKey]=useState(0);
 const [sidebar,setSidebar]=useState(false);
 const uploadAsset=useCallback(async(file)=>{
    const compressed=await optimizeImage(file);
    const body=new FormData();body.append('image',compressed);
    const r=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body});
    const json=await r.json();
    if(!r.ok||!json.url)throw new Error(json.error||'No se pudo cargar la imagen');
    return json.url;
 },[]);
 const refreshWallet=useCallback(async()=>{
   try{
     const r=await fetch('/api/wallet',{credentials:'same-origin',cache:'no-store'});
     if(!r.ok)return;
     const x=await r.json();
     setWallet(x?.wallet||null);
     setBillableModelIds((x?.models||[]).map(m=>m.model_id));
     setPilotPrice(x?.pilot_cost_cents??null);
     setPilotAvailable(Boolean(x?.generation_enabled));
     setGenerationReady(Boolean(x?.generation_enabled && (x?.wallet?.available_cents??0)>0));
   }catch{}
 },[]);
 useEffect(()=>{refreshWallet()},[refreshWallet]);
 const onWalletGenerate=useCallback(params=>generateWithRealizoWallet(params),[]);
 useEffect(()=>{
   if(page!=='videos')return;
   let cancelled=false;
   setJobsLoading(true);
   // Videos generated and Premium research projects have separate histories.
   Promise.allSettled([
     fetch('/api/realizo/jobs',{credentials:'same-origin',cache:'no-store'})
       .then(r=>r.ok?r.json():Promise.reject(new Error('video_history_unavailable'))),
     fetch('/api/realizo/ai-premium',{credentials:'same-origin',cache:'no-store'})
       .then(r=>r.ok?r.json():Promise.reject(new Error('premium_history_unavailable')))
   ]).then(([videos,projects])=>{
     if(cancelled)return;
     setJobs(videos.status==='fulfilled'?(videos.value.jobs||[]):[]);
     setPremiumProjects(projects.status==='fulfilled'?(projects.value.projects||[]):[]);
   }).finally(()=>{if(!cancelled)setJobsLoading(false)});
   return ()=>{cancelled=true};
 },[page]);
 async function exit(){
   try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}
   finally{window.location.assign('/login');}
 }
 function openEditor(){setEditorOpen(true);setPage('create');setSidebar(false)}
 function startNewVideo(){
   setPage('create');setEditorOpen(false);setBrief(null);setFormatPreset('ugc');
   setCreatorMode('automatic');setResumeProjectId(null);
   setCreateKey(current=>current+1);setSidebar(false);
 }
 function newPremiumProject(){
   setBrief(null);setEditorOpen(false);setResumeProjectId(null);setFormatPreset('ugc');
   setCreateKey(current=>current+1);setCreatorMode('premium');setPage('create');
 }
 function reopenPremiumProject(projectId){
   if(!/^[a-f0-9-]{36}$/i.test(projectId))return;
   setBrief(null);setEditorOpen(false);setResumeProjectId(projectId);
   setCreateKey(current=>current+1);setCreatorMode('premium');
   setPage('create');setSidebar(false);
 }
 function chooseCreatorMode(mode){
   setPage('create');setSidebar(false);
   setBrief(null);setResumeProjectId(null);setCreateKey(current=>current+1);
   setCreatorMode(mode);
   if(mode==='manual')openEditor();
 }
 function chooseVisualFormat(format){
  setBrief(null);setEditorOpen(false);setResumeProjectId(null);
  setFormatPreset(format);setCreatorMode('premium');setPage('create');
  setCreateKey(x=>x+1);setSidebar(false);
 }
 const nav=(id,label,icon,action)=>(
   <button key={id} type="button" onClick={()=>{setPage(id);setSidebar(false);if(action)action();}}
     className={navBase+' '+(page===id?'bg-[#EDE2FB] text-[#6542AB]':'text-[#756782] hover:bg-[#F7F0F7]')}>
      <Icon name={icon}/>{label}{page===id&&<span className="ml-auto h-2 w-2 rounded-full bg-[#E9898F]"/>}
   </button>
 );
 return <main className="realizo-app min-h-screen flex flex-col">
   <header className="realizo-topbar shrink-0 px-5 sm:px-7 flex items-center justify-between gap-3">
     <Link href="/studio" className="realizo-brand flex items-center gap-2.5 font-extrabold tracking-tight text-[24px]">
       <Mark/>realizo<span className="text-[#EF8B89]">.</span>
     </Link>
     <div className="flex items-center gap-3">
       <Link href="/wallet" className="realizo-balance inline-flex gap-2 items-center rounded-full font-bold text-[13px] px-4 py-2.5 transition">
         <Icon name="wallet" size={18}/>{wallet?usd(wallet.available_cents):'Mis créditos'}
       </Link>
       <button onClick={()=>setSidebar(b=>!b)} type="button" className="realizo-icon-button lg:hidden w-10 h-10 grid place-items-center rounded-full" aria-label="Abrir menú"><Icon name="sliders"/></button>
       <button onClick={exit} type="button" className="realizo-icon-button hidden lg:grid w-10 h-10 place-items-center rounded-full" aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="exit"/></button>
     </div>
   </header>

   <div className="flex flex-1 min-h-[calc(100vh-76px)]">
    <aside className={(sidebar?'block':'hidden')+' realizo-sidebar lg:block w-full lg:w-[245px] shrink-0 p-5 lg:p-6 space-y-4'}>
      <div className="hidden lg:block py-3 mb-5"><p className="text-[11px] tracking-[.18em] uppercase text-[#A58CB9] font-bold mb-2">Mi espacio</p><p className="text-lg font-extrabold leading-snug">Crea algo increíble<span className="text-[#F0928B]">.</span></p></div>
      <nav aria-label="Menú de Realizo" className="space-y-2">
       {nav('home','Inicio','video')}
       {nav('create','Crear video','sliders',startNewVideo)}
       {nav('videos','Mis videos','folder')}
       <Link href="/wallet" className={navBase+' text-[#756782] hover:bg-[#F7F0F7]'}><Icon name="wallet"/>Mis créditos<Icon name="chevron" size={14}/></Link>
      </nav>
      <div className="hidden lg:block pt-7"><div className="rounded-[22px] realizo-sidebar-banner p-5 relative overflow-hidden">
        <div className="absolute w-24 h-24 -right-8 -top-10 rounded-full bg-[#D7A2D8]/20"/>
        <p className="text-xs font-semibold text-[#F3BFAC] mb-2">Realizo Studio</p>
        <p className="text-[17px] leading-6 font-extrabold">De la idea al video, en un solo lugar.</p>
        <div className="mt-5 flex gap-1.5 items-center"><span className="h-2 w-2 rounded-full bg-[#BBF2CD]"/><span className="text-[10px] text-[#DCCFEB]">Tu estudio creativo</span></div>
      </div></div>
      <button onClick={exit} className="lg:hidden mt-6 inline-flex items-center gap-2 text-sm text-[#765F88] px-4 py-2"><Icon name="exit"/>Cerrar sesión</button>
    </aside>

    <div className="realizo-content flex-1 min-w-0 px-4 sm:px-7 lg:px-10 py-8">
     {page==='create'&&<>
      <section className="realizo-page-heading max-w-[1230px] mx-auto mb-8">
        <p className="uppercase tracking-[.19em] text-[#8A61B5] font-bold text-[11px]">Estudio de creación</p>
        <div className="flex flex-wrap items-center justify-between gap-5 mt-2">
          <div><h1 className="text-[33px] sm:text-[42px] tracking-[-.045em] font-extrabold leading-tight">{editorOpen?'Editor de video':'Crea tu próximo anuncio'}<span className="text-[#EB8A87]">.</span></h1>
          <p className="mt-2 text-[#8E8197] text-sm">{editorOpen?'Elige el modelo y configura tu generación.':'Del producto al anuncio, con un proceso visual y sencillo.'}</p></div>
          <button type="button" onClick={()=>{
            if(editorOpen && brief?.project_id){
              setResumeProjectId(brief.project_id);setCreatorMode('premium');
              setCreateKey(current=>current+1);
            }
            setEditorOpen(open=>!open);
          }} className="inline-flex gap-2 items-center text-[#6845AB] font-semibold text-sm bg-white rounded-full border border-[#E5D8E4] px-5 py-3 hover:bg-[#F1E9FC]">
            <Icon name={editorOpen?'arrow':'sliders'} size={18}/>{editorOpen?'Volver al producto':'Editor avanzado'}
          </button>
        </div>
      </section>

      {!editorOpen?<section className="max-w-[1230px] mx-auto space-y-6">
        <div className="realizo-modes flex flex-wrap gap-3 rounded-[22px] p-3" aria-label="Modalidad de creación">
          {[
            ['automatic','Automático · sin costo IA'],
            ['manual','Manual · tu prompt'],
            ['premium','✦ La IA decide todo · Premium']
          ].map(([id,label])=><button key={id} type="button"
            onClick={()=>chooseCreatorMode(id)}
            aria-pressed={creatorMode===id}
            className={'rounded-2xl px-5 py-3 text-sm font-bold transition '+
              (creatorMode===id?'bg-[#6E4BD2] text-white':'bg-[#F8F4FB] text-[#6B5092] hover:bg-[#EDE1FA]')}>
            {label}
          </button>)}
        </div>
        {creatorMode==='premium'?
          <RealizoPremium initialStyle={formatPreset} key={'premium-'+createKey+'-'+(resumeProjectId||'new')}
            initialProjectId={resumeProjectId}
            onPrepare={setBrief} onOpenAdvanced={openEditor} onCreateNew={newPremiumProject}
            onWalletRefresh={refreshWallet}
            onUseAutomatic={()=>chooseCreatorMode('automatic')}/>:
          <RealizoCreator accountId={accountId} onPrepare={setBrief} onOpenAdvanced={openEditor}/>}
       </section>:
       <section className="max-w-[1550px] mx-auto space-y-4">
        {brief&&<div className="rounded-2xl bg-[#E9DDFB] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px] text-[#624496] font-semibold">✓ Producto y ángulo de venta aplicados al editor</span>
          <button type="button" onClick={()=>{
            if(brief?.project_id){
              setResumeProjectId(brief.project_id);setCreatorMode('premium');
              setCreateKey(current=>current+1);
            }
            setEditorOpen(false);
          }} className="text-[#6E4BD2] text-[13px] font-bold hover:underline">Editar concepto</button>
        </div>}
        <div className="realizo-native-video rounded-[26px] overflow-hidden h-[min(790px,calc(100vh-190px))] min-h-[605px]">
          <VideoStudio locale="en" apiKey={null} persistenceScope={accountId} preparedBrief={brief}
            realizoBrand previewOnly freshCreation uploadAsset={uploadAsset}
            onWalletGenerate={onWalletGenerate} generationReady={generationReady}
            billableModelIds={billableModelIds} />
        </div>
        {pilotAvailable&&!generationReady&&<div className="rounded-2xl border border-[#EBD7C8] bg-[#FFF4E9] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-[#7A5663] font-semibold">Para generar necesitas al menos {usd(pilotPrice||35)} en tu billetera.</p>
          <Link href="/wallet" className="font-bold text-[#6845AB] text-sm underline">Recargar créditos de prueba</Link>
        </div>}
        {generationReady&&<p className="text-[13px] font-semibold text-[#6A4D9B]">Elige tu modelo, duración y resolución. Realizo te mostrará el precio exacto antes de confirmar cada video.</p>}
        {!pilotAvailable&&<p className="text-[12px] text-[#9A8B9B]">La generación se habilitará cuando tu cuenta esté lista para crear videos.</p>}
       </section>}
     </>}

     {page==='videos'&&<section className="max-w-[1030px] mx-auto">
       <p className="uppercase tracking-[.19em] text-[#8A61B5] font-bold text-[11px] mb-2">Biblioteca</p>
       <h1 className="text-[36px] tracking-tight font-extrabold">Mis videos<span className="text-[#EB8A87]">.</span></h1>
       <div className="rounded-[25px] bg-white border border-[#E8DEDA] p-6 sm:p-8 mt-7">
         {jobsLoading?<p role="status" className="text-[#867A91]">Cargando tus videos…</p>:
          jobs.length?<div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {jobs.map(job=><article key={job.id} className="rounded-2xl border border-[#E9DEE2] bg-[#FAF7F4] overflow-hidden">
              <div className="h-32 bg-[#EBE1F6] flex items-center justify-center">
                {job.video_url?<video src={job.video_url} controls preload="metadata" className="w-full h-full object-cover" />:
                 <Icon name="video" size={39}/>}
              </div>
              <div className="p-4 space-y-2">
               <p className="font-bold text-[13px] truncate">{job.model}</p>
               <p className="text-xs text-[#8A7C90]">{new Date(job.created_at+'Z').toLocaleDateString('es-EC')}</p>
               <span className="inline-flex text-[11px] rounded-full bg-[#EBE1F8] text-[#7155A1] px-3 py-1 font-semibold">
                {job.status==='completed'?'Completado':job.status==='failed'?'No completado':job.status==='unknown'?'En revisión':'En proceso'}
               </span>
               {job.video_url&&<a href={job.video_url} target="_blank" rel="noopener noreferrer" className="block text-[#6E4BD2] underline text-sm font-semibold">Abrir video</a>}
              </div>
            </article>)}
          </div>:
          <div className="py-14 text-center">
           <div className="inline-grid place-items-center w-16 h-16 bg-[#F0E6FB] rounded-2xl text-[#8057BC]"><Icon name="folder" size={29}/></div>
           <h2 className="text-[23px] font-bold mt-5">Tu biblioteca empieza aquí</h2>
           <p className="text-sm text-[#8E8294] mt-2">Tus videos aparecerán cuando completes una generación.</p>
           <button onClick={startNewVideo} className="inline-flex gap-2 items-center mt-6 rounded-2xl bg-[#6E4BD2] text-white font-bold px-5 py-3"><Icon name="video"/>Crear un video</button>
          </div>}
       </div>
       {premiumProjects.length>0&&<section className="rounded-[25px] bg-white border border-[#E8DEDA] p-6 sm:p-8 mt-6">
        <h2 className="text-xl font-extrabold">Proyectos Premium guardados</h2>
        <p className="text-sm text-[#8A7C90] mt-1 mb-4">Investigaciones y guiones anteriores, separados de los videos. Solo se reabren cuando tú lo decides.</p>
        <div className="grid sm:grid-cols-2 gap-3">
         {premiumProjects.map(item=><article key={item.id} className="rounded-2xl border border-[#EBE1EB] bg-[#FAF8FC] p-4 space-y-2">
           <p className="font-bold text-sm">{item.product_name||'Producto sin nombre'}</p>
           <p className="text-xs text-[#8A7C90]">{item.created_at&&new Date(item.created_at.replace(' ','T')+'Z').toLocaleDateString('es-EC')} · {({
             approved:'Concepto aprobado',ready:'Listo para revisar',needs_review:'Revisión disponible',
             researching:'Investigación en curso',created:'Preparando',failed:'No completado'
           })[item.status]||item.status}</p>
           <button type="button" onClick={()=>reopenPremiumProject(item.id)}
             className="text-[#6E4BD2] font-bold text-sm underline">
             {['created','researching'].includes(item.status)?'Continuar investigación':'Abrir proyecto'}
           </button>
         </article>)}
        </div>
       </section>}
      </section>}
    </div>
   </div>
 </main>;
}
