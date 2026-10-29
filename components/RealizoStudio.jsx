'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { VideoStudio } from 'studio';

function Mark() {
  return <svg width="35" height="35" viewBox="0 0 56 56" fill="none" aria-hidden="true">
    <defs><linearGradient id="realizo-studio-logo" x1="2" y1="7" x2="53" y2="53">
      <stop stopColor="#FF987B"/><stop offset=".53" stopColor="#F469A6"/><stop offset="1" stopColor="#A279FF"/>
    </linearGradient></defs>
    <rect width="56" height="56" rx="18" fill="url(#realizo-studio-logo)"/>
    <path d="M19 14.5v27l23-13.5L19 14.5Z" fill="#261C3C"/>
    <path d="M21.7 20.2 35 28l-13.3 7.8V20.2Z" fill="#FFF6EF"/>
    <circle cx="43" cy="13" r="4.5" fill="#C6FFCB"/>
  </svg>;
}
function WalletIcon(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18" aria-hidden="true">
    <rect x="3" y="6" width="18" height="14" rx="3"/><path d="M3 9V6a3 3 0 0 1 3-3h12"/><path d="M16 13h5"/><circle cx="16" cy="13" r=".8" fill="currentColor" stroke="none"/>
  </svg>;
}
function VideoIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="19" height="19" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3V9Z"/>
  </svg>;
}
function ExitIcon(){
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="18" height="18" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h3"/><path d="M13 8l4 4-4 4M8 12h9"/>
  </svg>;
}
const usd=cents=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((cents||0)/100);

export default function RealizoStudio({ accountId }) {
  const [wallet,setWallet]=useState(null);
  useEffect(()=>{
    const controller = new AbortController();
    fetch('/api/wallet',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(response=>response.ok?response.json():null)
      .then(data=>setWallet(data?.wallet||null))
      .catch(()=>{});
    return ()=>controller.abort();
  },[]);

  const logout=async()=>{
    try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});}
    finally{window.location.assign('/login');}
  };

  return <main className="min-h-screen bg-[#F7F3EE] text-[#251D37] flex flex-col">
    <header className="flex items-center justify-between gap-3 px-4 sm:px-7 py-3 bg-[#F7F3EE] border-b border-[#E6DFD8]">
      <Link href="/studio" className="flex items-center gap-2.5 font-extrabold text-[23px] tracking-tight"
        aria-label="Realizo, estudio de video">
        <Mark/><span>realizo<span className="text-[#F08078]">.</span></span>
      </Link>
      <nav aria-label="Navegación principal" className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
        <span className="hidden sm:inline-flex items-center gap-2 rounded-full bg-[#E9DDFE] text-[#5A3CA3] px-4 py-2 text-[13px] font-semibold">
          <VideoIcon/> Estudio de videos
        </span>
        <Link href="/wallet"
          className="inline-flex items-center gap-2 rounded-full bg-white border border-[#E5DCD5] px-3 sm:px-4 py-2 text-[13px] font-semibold hover:border-[#B49ADB] transition">
          <WalletIcon/><span className="hidden sm:inline">Mis créditos</span>
          <span className="tabular-nums">{wallet?usd(wallet.available_cents):'—'}</span>
        </Link>
        <button type="button" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión"
          className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-[#EDE7E7] text-[#5F536A] hover:bg-[#E9DDFE] transition">
          <ExitIcon/>
        </button>
      </nav>
    </header>

    <section className="px-4 sm:px-7 pt-6 pb-4">
      <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-end gap-3">
        <div>
          <p className="text-[11px] tracking-[.18em] uppercase font-bold text-[#986BB8]">Tu espacio creativo</p>
          <h1 className="text-[29px] sm:text-[36px] tracking-[-.04em] font-extrabold mt-1">Crea tu próximo video<span className="text-[#EC8E83]">.</span></h1>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-medium bg-[#E8DDF3] text-[#694B91]">
          <span className="w-2 h-2 bg-[#D18E8C] rounded-full" aria-hidden="true"/>
          Vista previa del estudio
        </span>
      </div>
    </section>

    <section className="px-3 sm:px-6 pb-6 flex-1 min-h-[690px]">
      <div className="max-w-[1580px] mx-auto h-[min(950px,calc(100vh-192px))] min-h-[630px] rounded-[26px] overflow-hidden border-[5px] border-[#302345] shadow-[0_18px_55px_rgba(39,26,68,.14)] relative realizo-native-video">
        <VideoStudio
          locale="en"
          apiKey={null}
          persistenceScope={accountId}
          previewOnly
        />
      </div>
    </section>
  </main>;
}
