'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { optimizeImage } from '@/lib/realizo-creative/optimize-image';
import { generateWithRealizoWallet } from '@/lib/realizo-creative/wallet-generation';
import { downloadRealizoVideo } from '@/lib/realizo-creative/download-video';
import RealizoPremium from '@/components/RealizoPremium';
import RealizoHyperrealPro from '@/components/RealizoHyperrealPro';
import RealizoVisualGallery from '@/components/RealizoVisualGallery';
import RealizoTemplateLibrary from '@/components/RealizoTemplateLibrary';
import RealizoTemplateCreator from '@/components/RealizoTemplateCreator';
import RealizoMotionHome from '@/components/RealizoMotionHome';
import ConversionTemplatesStudio from '@/components/ConversionTemplatesStudio';
import RealizoCreationsGallery from '@/components/RealizoCreationsGallery';
import RealizoSeedanceFlow from '@/components/RealizoSeedanceFlow';
import {getAdTemplate} from '@/lib/realizo-creative/ad-templates';

function Mark() {
  return <svg width="37" height="37" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <defs><linearGradient id="realizo-studio-sign" x1="2" y1="5" x2="54" y2="52">
      <stop stopColor="#FFB76D"/><stop offset=".53" stopColor="#F49348"/><stop offset="1" stopColor="#A96032"/>
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
const navBase='realizo-nav-link flex items-center gap-3 px-4 py-3 rounded-2xl transition w-full text-left font-semibold text-[14px]';
export default function RealizoStudio({accountId,guest=false,initialPage='home'}){
 const shellRef=useRef(null);
 const [wallet,setWallet]=useState(null);
 const [billableModelIds,setBillableModelIds]=useState([]);
 const [generationReady,setGenerationReady]=useState(false);
 const [pilotAvailable,setPilotAvailable]=useState(false);
 const [pilotPrice,setPilotPrice]=useState(null);
 const [jobs,setJobs]=useState([]);
 const [imageCreations,setImageCreations]=useState([]);
 const [creationsWarning,setCreationsWarning]=useState('');
 const [creationsRefresh,setCreationsRefresh]=useState(0);
 const [jobsLoading,setJobsLoading]=useState(false);
 const [downloadJob,setDownloadJob]=useState(null);
 const [savingTemplateJob,setSavingTemplateJob]=useState(null);
 const [templateNotice,setTemplateNotice]=useState('');
 const [downloadError,setDownloadError]=useState('');
 const [downloadProgress,setDownloadProgress]=useState('');
 const [downloadReady,setDownloadReady]=useState(null);
 const [premiumProjects,setPremiumProjects]=useState([]);
 const [page,setPage]=useState(initialPage);
 const [formatPreset,setFormatPreset]=useState('ugc');
 const [templateId,setTemplateId]=useState(null);
 const [brief,setBrief]=useState(null);
 const [editorOpen,setEditorOpen]=useState(false);
 const [creatorMode,setCreatorMode]=useState('premium');
 const [resumeProjectId,setResumeProjectId]=useState(null);
 const [createKey,setCreateKey]=useState(0);
 const [sidebar,setSidebar]=useState(false);
 const loginUrl='/login';
 function requireLogin(){window.location.assign(loginUrl)}
 const uploadAsset=useCallback(async(file)=>{
    const compressed=await optimizeImage(file);
    const body=new FormData();body.append('image',compressed);
    const r=await fetch('/api/realizo/media',{method:'POST',credentials:'same-origin',body});
    const json=await r.json();
    if(!r.ok||!json.url)throw new Error(json.error||'No se pudo cargar la imagen');
    return json.url;
 },[]);
 const refreshWallet=useCallback(async()=>{
   if(guest)return;
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
 },[guest]);
 useEffect(()=>{if(!guest)refreshWallet()},[guest,refreshWallet]);
 useEffect(()=>{
   const root=shellRef.current;
   if(!root)return;
   const protect=()=>{
     root.querySelectorAll('video').forEach(video=>{
       // Native downloads are available for completed owned videos only.
        const owned=video.dataset.realizoOwnedVideo==='true';
        video.setAttribute('controlsList',owned
          ?'noremoteplayback noplaybackrate'
          :'nodownload noremoteplayback noplaybackrate');
       video.disablePictureInPicture=true;
     });
   };
   const preventMediaMenu=event=>{
     if(event.target?.closest?.('[data-realizo-owned-video="true"]'))return;
      if(event.target?.closest?.('video,.realizo-native-video,.realizo-template-modal'))
       event.preventDefault();
   };
   const observer=new MutationObserver(protect);
   observer.observe(root,{childList:true,subtree:true});
   root.addEventListener('contextmenu',preventMediaMenu);
   protect();
   return ()=>{observer.disconnect();root.removeEventListener('contextmenu',preventMediaMenu)};
 },[]);

 const onWalletGenerate=useCallback((params,opts)=>generateWithRealizoWallet(params,opts),[]);
 const savePersonalTemplate=useCallback(async(recipe)=>{
   const r=await fetch('/api/realizo/user-templates',{
     method:'POST',credentials:'same-origin',
     headers:{'Content-Type':'application/json'},body:JSON.stringify(recipe)
   });
   const data=await r.json().catch(()=>({}));
   if(!r.ok)throw Error(({
     template_source_unavailable:'Este video es anterior a la nueva función. Guarda su prompt desde el editor.',
     template_limit_reached:'Llegaste al límite de 100 plantillas. Elimina alguna para continuar.',
     invalid_template:'Revisa la descripción del video antes de guardar.'
   })[data.error]||'No pudimos guardar la plantilla.');
   return data.template;
 },[]);
 async function chooseSavedTemplate(summary){
   const r=await fetch('/api/realizo/user-templates/'+encodeURIComponent(summary.id),{
     credentials:'same-origin',cache:'no-store'
   });
   const data=await r.json().catch(()=>({}));
   if(!r.ok||!data.template?.prompt)throw Error('No se pudo abrir esta plantilla.');
   const t=data.template;
   setBrief({
     revision:'user-template-'+t.id+'-'+Date.now(),
     prompt:t.prompt,
     video_model_id:t.model_id,
     video_duration_seconds:t.duration_seconds||8,
     video_workflow_id:t.workflow_id||null,
     images:[],
     media_role:t.workflow_id==='references'?'reference_only':'user_template',
     creative_style:t.category==='cine_premium'?'premium':t.category==='ugc'?'ugc':'commercial',
   });
   setTemplateId(null);setFormatPreset(t.category==='cine_premium'?'premium':'ugc');
   setResumeProjectId(null);setCreatorMode('seedance');
   setEditorOpen(false);setPage('create');setCreateKey(n=>n+1);setSidebar(false);
 }
 useEffect(()=>{
   if(guest||page!=='videos')return;
   let cancelled=false;
   setJobsLoading(true);
   Promise.allSettled([
     fetch('/api/realizo/jobs',{credentials:'same-origin',cache:'no-store'})
       .then(r=>r.ok?r.json():Promise.reject(new Error('video_history_unavailable'))),
     fetch('/api/realizo/ai-premium',{credentials:'same-origin',cache:'no-store'})
       .then(r=>r.ok?r.json():Promise.reject(new Error('premium_history_unavailable'))),
     fetch('/api/realizo/images/history',{credentials:'same-origin',cache:'no-store'})
       .then(r=>r.ok?r.json():Promise.reject(new Error('image_history_unavailable')))
   ]).then(([videos,projects,images])=>{
     if(cancelled)return;
     setJobs(videos.status==='fulfilled'?(videos.value.jobs||[]):[]);
     setPremiumProjects(projects.status==='fulfilled'?(projects.value.projects||[]):[]);
     setImageCreations(images.status==='fulfilled'?(images.value.creations||[]):[]);
     setCreationsWarning(videos.status==='rejected'||images.status==='rejected'
       ?'No se pudo cargar todo el historial. Pulsa Actualizar para volver a intentarlo.':'');
   }).finally(()=>{if(!cancelled)setJobsLoading(false)});
   return ()=>{cancelled=true};
 },[page,guest,creationsRefresh]);
 // Reconciliar los videos pendientes al abrir Mis videos desde cualquier dispositivo.
 // La generación ocurre en MuAPI y sigue aunque la pantalla se cierre; el resultado
 // vuelve a D1 al consultar el ID autenticado, sin reenviar ni cobrar el trabajo.
 useEffect(()=>{
   if(guest||page!=='videos')return;
   const pending=jobs.filter(job=>['sent','reserved'].includes(job.status)).slice(0,6);
   if(!pending.length)return;
   let cancelled=false,timeout;
   const reconcile=async()=>{
     try{
       const checks=await Promise.allSettled(pending.map(item=>
         fetch('/api/wallet/jobs/'+encodeURIComponent(item.id),{
           credentials:'same-origin',cache:'no-store'
         }).then(r=>r.ok||r.status===202?r.json():Promise.reject(new Error('status_unavailable')))
       ));
       if(cancelled)return;
       const finalized=checks.some(item=>item.status==='fulfilled'&&
         ['completed','failed'].includes(item.value.status));
       if(finalized){setCreationsRefresh(count=>count+1);return;}
     }catch{}
     if(!cancelled)timeout=setTimeout(reconcile,5500);
   };
   reconcile();
   return ()=>{cancelled=true;clearTimeout(timeout);};
 },[page,guest,jobs]);

 async function exit(){
   try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}
   finally{window.location.assign('/login');}
 }
 function openEditor(){if(guest)return requireLogin();setEditorOpen(true);setPage('create');setSidebar(false)}
 function startNewVideo(){
   if(guest)return requireLogin();
   setPage('create');setEditorOpen(false);setBrief(null);setFormatPreset('ugc');
   setCreatorMode('premium');setResumeProjectId(null);setTemplateId(null);
   setCreateKey(current=>current+1);setSidebar(false);
 }
 function newPremiumProject(){
   if(guest)return requireLogin();
   setBrief(null);setEditorOpen(false);setResumeProjectId(null);setFormatPreset('ugc');setTemplateId(null);
   setCreateKey(current=>current+1);setCreatorMode('premium');setPage('create');
 }
 function reopenPremiumProject(projectId){
   if(guest)return requireLogin();
   if(!/^[a-f0-9-]{36}$/i.test(projectId))return;
   setBrief(null);setEditorOpen(false);setResumeProjectId(projectId);setTemplateId(null);
   setCreateKey(current=>current+1);setCreatorMode('premium');
   setPage('create');setSidebar(false);
 }
 function chooseCreatorMode(mode){
   if(guest)return requireLogin();
   setPage('create');setSidebar(false);
   setBrief(null);setResumeProjectId(null);setTemplateId(null);setCreateKey(current=>current+1);
   setCreatorMode(mode);
   // El creador público utiliza un único flujo guiado Seedance 2.0.
 }
 function chooseVisualFormat(format){
  if(guest)return requireLogin();
  setBrief(null);setEditorOpen(false);setResumeProjectId(null);
  setFormatPreset(format);setTemplateId(null);setCreatorMode('premium');setPage('create');
  setCreateKey(x=>x+1);setSidebar(false);
 }
 function chooseAdTemplate(id){
  if(guest)return requireLogin();
  const item=getAdTemplate(id);
  if(!item)return;
  setBrief(null);setEditorOpen(false);setResumeProjectId(null);
  setTemplateId(item.id);setFormatPreset(item.style);
  setCreatorMode('seedance');setPage('create');setSidebar(false);
  setCreateKey(x=>x+1);
 }
 const nav=(id,label,icon,action)=>(
   <button key={id} type="button" onClick={()=>{setPage(id);setSidebar(false);if(action)action();}}
     aria-current={page===id?'page':undefined}
     className={navBase+' '+(page===id?'bg-[#EDE2FB] text-[#6542AB]':'text-[#756782] hover:bg-[#F7F0F7]')}>
      <Icon name={icon}/>{label}{page===id&&<span className="ml-auto h-2 w-2 rounded-full bg-[#E9898F]"/>}
   </button>
 );
 return <main ref={shellRef} className="realizo-app min-h-screen flex flex-col">
   <header className="realizo-topbar shrink-0 px-5 sm:px-7 flex items-center justify-between gap-3">
     <Link href="/studio" className="realizo-brand flex items-center gap-2.5 font-extrabold tracking-tight text-[24px]">
       <Mark/>realizo<span className="text-[#EF8B89]">.</span>
     </Link>
     <nav className="realizo-v11-topnav" aria-label="Navegación principal">
       <button type="button" aria-current={page==='home'?'page':undefined} onClick={()=>setPage('home')}>Inicio</button>
       <button type="button" aria-current={page==='templates'?'page':undefined} onClick={()=>{setTemplateId(null);setPage('templates')}}>Plantillas</button>
       <button type="button" aria-current={page==='images'?'page':undefined} onClick={()=>setPage('images')}>Imágenes</button>
       <button type="button" onClick={startNewVideo}>Crear video</button>
       <button type="button" aria-current={page==='hyperreal'?'page':undefined} onClick={()=>setPage('hyperreal')}>Hiperrealista PRO</button>
       <button type="button" onClick={()=>setPage('videos')}>Mis creaciones</button>
      </nav>
     <div className="flex items-center gap-3">
       {guest?<Link href={loginUrl} className="realizo-login-cta inline-flex items-center gap-2 rounded-full font-bold text-[13px] px-5 py-2.5 transition">
         Iniciar sesión <Icon name="arrow" size={16}/>
       </Link>:
       <Link href="/wallet" className="realizo-balance inline-flex gap-2 items-center rounded-full font-bold text-[13px] px-4 py-2.5 transition">
         <Icon name="wallet" size={18}/>{wallet?usd(wallet.available_cents):'Mis créditos'}
       </Link>}
       <button onClick={()=>setSidebar(b=>!b)} type="button" className="realizo-icon-button lg:hidden w-10 h-10 grid place-items-center rounded-full" aria-label="Abrir menú"><Icon name="sliders"/></button>
       {!guest&&<button onClick={exit} type="button" className="realizo-icon-button hidden lg:grid w-10 h-10 place-items-center rounded-full" aria-label="Cerrar sesión" title="Cerrar sesión"><Icon name="exit"/></button>}
     </div>
   </header>

   <div className="flex flex-1 min-h-[calc(100vh-76px)]">
    <aside className={(sidebar?'block':'hidden')+' realizo-sidebar lg:block w-full lg:w-[245px] shrink-0 p-5 lg:p-6 space-y-4'}>
      <div className="hidden lg:block py-3 mb-5"><p className="realizo-kicker mb-2">REALIZO AI STUDIO</p><p className="text-lg font-extrabold leading-snug">Estudio creativo<span className="realizo-orange">.</span></p></div>
      <nav aria-label="Menú de Realizo" className="space-y-2">
       {nav('home','Inicio','video')}
       {nav('create','Crear video','video',startNewVideo)}
       {nav('hyperreal','Hiperrealista PRO','sliders')}
       {nav('templates','Plantillas','sliders',()=>setTemplateId(null))}
       {nav('images','Imágenes que venden','sliders')}
       {nav('videos','Mis creaciones','folder')}
       <Link href={guest?loginUrl:'/wallet'} className={navBase+' text-[#756782] hover:bg-[#F7F0F7]'}><Icon name="wallet"/>Mis créditos{guest?<Icon name="chevron" size={14}/>:<Icon name="chevron" size={14}/>}</Link>
      </nav>
      <div className="hidden lg:block pt-7"><div className="rounded-[22px] realizo-sidebar-banner p-5 relative overflow-hidden">
        <div className="absolute w-24 h-24 -right-8 -top-10 rounded-full bg-[#D7A2D8]/20"/>
        <p className="realizo-kicker mb-2">REALIZO STUDIO</p>
        <p className="text-[17px] leading-6 font-extrabold">Tu próxima gran campaña empieza aquí.</p>
        <div className="mt-5 flex gap-1.5 items-center"><span className="h-2 w-2 rounded-full bg-[#BBF2CD]"/><span className="text-[10px] text-[#DCCFEB]">Tu estudio creativo</span></div>
      </div></div>
      {guest?<Link href={loginUrl} className="lg:hidden mt-6 inline-flex items-center gap-2 text-sm text-[#fdb77b] px-4 py-2"><Icon name="arrow"/>Iniciar sesión</Link>:<button onClick={exit} className="lg:hidden mt-6 inline-flex items-center gap-2 text-sm text-[#765F88] px-4 py-2"><Icon name="exit"/>Cerrar sesión</button>}
    </aside>

    <div className="realizo-content flex-1 min-w-0 px-4 sm:px-7 lg:px-10 py-8">
     <div className="realizo-contextbar max-w-[1420px] mx-auto" aria-label="Espacio actual">
      <span>WORKSPACE</span><span aria-hidden="true">/</span>
      <strong>{page==='home'?'Inicio':page==='create'?'Crear anuncio':page==='templates'?(templateId?'Usar plantilla':'Plantillas'):page==='images'?'Imágenes que venden':page==='hyperreal'?'Hiperrealista PRO':'Mis creaciones'}</strong>
      <span className="realizo-contextbar-right">REALIZO AI STUDIO</span>
     </div>
     {page==='home'&&<RealizoMotionHome
        onCreate={startNewVideo}
        onTemplates={()=>{setTemplateId(null);setPage('templates')}}
        onImages={()=>setPage('images')}
        onUseTemplate={chooseAdTemplate}
        onManual={()=>chooseCreatorMode('manual')}
        onViewVideos={()=>setPage('videos')}
      />}
     {page==='templates'&&<div className="realizo-templates-page max-w-[1420px] mx-auto">
       {templateId?
        <RealizoTemplateCreator key={templateId+'-'+createKey} templateId={templateId}
         onBack={()=>setTemplateId(null)}
         onWalletRefresh={refreshWallet}
         onViewVideos={()=>{setTemplateId(null);setPage('videos')}}/>:
        <>
         <div className="realizo-page-intro">
          <p className="realizo-kicker">PLANTILLAS REALES</p>
          <h1>Elige tu próxima <em>creación.</em></h1>
         </div>
         <RealizoTemplateLibrary onChoose={chooseAdTemplate} onChooseSaved={chooseSavedTemplate} guest={guest}/>
        </>}
      </div>}
     {page==='images'&&<ConversionTemplatesStudio guest={guest} onViewCreations={()=>setPage('videos')} onGenerationComplete={refreshWallet} onGenerationEnd={refreshWallet} />}
     {page==='hyperreal'&&<RealizoHyperrealPro guest={guest} onWalletGenerate={onWalletGenerate}
       onWalletRefresh={refreshWallet}
       onGenerationComplete={()=>{setPage('videos');setCreationsRefresh(n=>n+1);refreshWallet();}}
       onViewCreations={()=>{setPage('videos');setCreationsRefresh(n=>n+1);}}/>}
     {page==='create'&&(
       resumeProjectId
         ? <section className="max-w-[1230px] mx-auto">
             <div className="mb-5 rounded-2xl bg-white border border-[#e8dfe9] p-4 text-[13px] text-[#776482]">
               Estás reabriendo un proyecto anterior. Para empezar uno nuevo con Seedance 2.0, selecciona Crear video.
             </div>
             <RealizoPremium key={'legacy-'+resumeProjectId+'-'+createKey} initialProjectId={resumeProjectId}
               initialStyle={formatPreset} onPrepare={setBrief} onOpenAdvanced={openEditor}
               onCreateNew={startNewVideo} onWalletGenerate={onWalletGenerate}
               onGenerationComplete={()=>{setPage('videos');setCreationsRefresh(n=>n+1);refreshWallet();}}
               onViewCreations={()=>{setPage('videos');setCreationsRefresh(n=>n+1);}}
               onWalletRefresh={refreshWallet}/>
           </section>
         : <RealizoSeedanceFlow key={'seedance-'+createKey} accountId={accountId}
             initialStyle={formatPreset}
             initialNotes={brief?.prompt||''}
             uploadAsset={uploadAsset} onWalletRefresh={refreshWallet}
             onViewVideos={()=>{setPage('videos');setCreationsRefresh(n=>n+1);}}/>
     )}

     {page==='videos'&&<section className="realizo-videos-page max-w-[1250px] mx-auto">
      {templateNotice&&<p role="status" className="rounded-xl bg-[#ECE4F8] px-4 py-3 text-[#694A9A] text-sm mb-3">{templateNotice}</p>}
      {downloadError&&<p role="alert" className="mb-3 text-sm text-red-600">{downloadError}</p>}
       <p className="uppercase tracking-[.19em] text-[#8A61B5] font-bold text-[11px] mb-2">Biblioteca</p>
       <h1 className="text-[36px] tracking-tight font-extrabold">Mis creaciones<span className="text-[#EB8A87]">.</span></h1>
       <p className="realizo-videos-intro">Todas tus imágenes y videos, organizados en una sola biblioteca.</p>
       {guest?<div className="realizo-public-empty" role="region" aria-label="Creaciones para visitantes">
         <div className="realizo-public-empty-icon"><Icon name="folder" size={34}/></div>
         <h2>Tus creaciones en un solo lugar</h2>
         <p>Inicia sesión para acceder a todas tus imágenes y videos generados con Realizo.</p>
         <button type="button" onClick={requireLogin}><Icon name="folder" size={18}/> Iniciar sesión</button>
       </div>:
       <RealizoCreationsGallery videos={jobs} images={imageCreations} loading={jobsLoading}
         warning={creationsWarning} onCreateVideo={startNewVideo}
         onCreateImage={()=>setPage('images')}
         onSaveVideoTemplate={async id=>savePersonalTemplate({job_id:id})}
         onRefresh={()=>setCreationsRefresh(n=>n+1)}/>}
       {!guest&&premiumProjects.length>0&&<section className="rounded-[25px] bg-white border border-[#E8DEDA] p-6 sm:p-8 mt-6">
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
