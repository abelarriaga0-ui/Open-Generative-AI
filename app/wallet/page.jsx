'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import PaypalTopup from '@/components/wallet/PaypalTopup';
const money = cents => new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((cents||0)/100);

function Mark() {
  return <svg width="36" height="36" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <defs><linearGradient id="realizo-wallet-mark" x1="0" y1="0" x2="54" y2="54"><stop stopColor="#FF987B"/><stop offset=".55" stopColor="#F469A6"/><stop offset="1" stopColor="#A279FF"/></linearGradient></defs>
    <rect width="56" height="56" rx="18" fill="url(#realizo-wallet-mark)"/><path d="M19 14.5v27l23-13.5L19 14.5Z" fill="#261C3C"/>
    <path d="M21.7 20.2 35 28l-13.3 7.8V20.2Z" fill="#FFF6EF"/><circle cx="43" cy="13" r="4.5" fill="#C6FFCB"/>
  </svg>;
}
function FilmIcon(){return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/></svg>;}
function WalletIcon(){return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 9V6a3 3 0 0 1 3-3h12"/><path d="M16 13h5"/></svg>;}
export default function WalletPage(){
  const [data,setData]=useState(null);
  const [error,setError]=useState(null);
  const [ownAuth,setOwnAuth]=useState(false);
  const router=useRouter();
  useEffect(()=>{
    const controller=new AbortController();
    fetch('/api/auth/features',{cache:'no-store',signal:controller.signal})
      .then(r=>r.json()).then(r=>setOwnAuth(Boolean(r.enabled))).catch(()=>{});
    fetch('/api/wallet',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async r=>{
        if(r.status===401){router.replace('/login');return null;}
        const j=await r.json();
        if(!r.ok)throw Error(j.message||j.error||'No se pudo cargar tu billetera.');
        return j;
      }).then(j=>{if(j)setData(j)})
      .catch(e=>{if(e.name!=='AbortError')setError(e.message)});
    return ()=>controller.abort();
  },[router]);
  async function logout(){
    try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}
    finally{window.location.assign('/login');}
  }
  const entries={deposit:'Recarga',reserve:'Generación reservada',capture:'Video completado',release:'Reserva devuelta'};
  return <main className="realizo-wallet-page min-h-screen">
    <header className="border-b border-[#E8E0D9] bg-[#F7F3EE]">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <Link href="/studio" className="inline-flex gap-2 items-center font-extrabold tracking-tight text-[23px]"><Mark/>realizo<span className="text-[#EC8E83]">.</span></Link>
        <nav aria-label="Navegación principal" className="flex items-center gap-3">
          <Link href="/studio" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#E9DDFE] text-[#5A3CA3] text-sm font-semibold hover:bg-[#DDCDFB] transition"><FilmIcon/> <span>Estudio de videos</span></Link>
          {ownAuth&&<button type="button" className="text-sm font-semibold text-[#6F6478] hover:text-[#513782] p-2" onClick={logout}>Salir</button>}
        </nav>
      </div>
    </header>
    <div className="max-w-6xl mx-auto px-5 py-8 sm:py-12 space-y-7">
      <div>
        <p className="text-[11px] uppercase tracking-[.18em] font-bold text-[#9467AD] mb-2">Mi cuenta</p>
        <h1 className="text-[35px] sm:text-[44px] tracking-[-.045em] font-extrabold">Mis créditos<span className="text-[#ED8D87]">.</span></h1>
      </div>
      {error&&<div role="alert" className="rounded-2xl bg-[#FFF2E8] border border-[#E7CDBE] p-5 text-[#654D43]">{error}</div>}
      {!data&&!error&&<p role="status" className="text-[#82718C]">Cargando...</p>}
      {data&&<>
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="relative overflow-hidden rounded-[26px] bg-[#302246] text-white p-7 sm:p-8 shadow-[0_16px_40px_rgba(48,34,70,.13)]">
            <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-[#9D70CF]/20"/>
            <div className="relative">
              <div className="flex items-center justify-between text-[#DCCBEB] text-sm font-semibold">
                <span>Saldo disponible</span><WalletIcon/>
              </div>
              <p className="mt-5 text-[42px] sm:text-[52px] leading-none tracking-[-.04em] font-extrabold text-[#FFC3AF] tabular-nums">{money(data.wallet.available_cents)}</p>
              <p className="mt-6 text-sm text-[#CDBFDF]">Listo para crear tus videos</p>
            </div>
          </section>
          <section className="rounded-[26px] bg-white border border-[#E7DFD8] p-7 sm:p-8">
            <p className="text-[#83748D] text-sm font-semibold">Saldo reservado</p>
            <p className="mt-5 text-[42px] sm:text-[52px] leading-none tracking-[-.04em] font-extrabold tabular-nums">{money(data.wallet.reserved_cents)}</p>
            <p className="mt-6 text-sm text-[#897B92]">Créditos de videos en proceso</p>
          </section>
        </div>
        <div className="grid lg:grid-cols-[1.2fr_.8fr] gap-5 items-start">
          <section className="rounded-[26px] bg-white border border-[#E7DFD8] p-6 sm:p-8">
            <h2 className="text-2xl tracking-tight font-extrabold mb-6">Recargar créditos</h2>
            <PaypalTopup minCents={data.min_topup_cents} firstTopup={data.first_topup} onPaid={()=>window.location.reload()} theme="light"/>
          </section>
          <section className="rounded-[26px] bg-white border border-[#E7DFD8] p-6 sm:p-8">
            <h2 className="text-2xl tracking-tight font-extrabold mb-5">Actividad</h2>
            {!data.activity.length?<p className="text-[#8A7C91]">Sin movimientos todavía.</p>:
              <ul className="divide-y divide-[#ECE5E1]">
                {data.activity.map((item,i)=><li className="flex justify-between gap-3 py-3 text-sm" key={i}>
                  <span>{item.external_reference?.startsWith('historical-muapi-prepaid:')?'Saldo anterior de Muapi':item.external_reference?.startsWith('pilot-credit:')?'Bono de prueba':(entries[item.kind]||item.kind)}<small className="block mt-1 text-[#94889C]">{item.created_at}</small></span>
                  <strong className="tabular-nums whitespace-nowrap">{money(item.available_delta_cents)}</strong>
                </li>)}
              </ul>
            }
          </section>
        </div>
      </>}
    </div>
  </main>;
}
