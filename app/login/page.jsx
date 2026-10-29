'use client';
import { useEffect,useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
export default function LoginPage() {
  const router=useRouter();
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [step,setStep]=useState('email');
  const [features,setFeatures]=useState(null);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    let active=true;
    Promise.all([
      fetch('/api/auth/features',{cache:'no-store'}).then(r=>r.json()),
      fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json())
    ]).then(([flags,session])=>{
      if(!active)return;
      setFeatures(flags);
      if(session.authenticated)router.replace('/wallet');
    }).catch(()=>{if(active)setFeatures({enabled:false,email:false,google:false});});
    return ()=>{active=false};
  },[router]);
  async function sendCode(e){
    e.preventDefault();if(busy)return;
    setBusy(true);setNotice('');
    try{
      const r=await fetch('/api/auth/email/start',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
      if(!r.ok)throw Error('send_failed');
      setStep('code');setNotice('Revisa tu correo electrónico. El código caduca en 10 minutos.');
    }catch{setNotice('No se pudo enviar el código. Inténtalo de nuevo.');}
    setBusy(false);
  }
  async function verify(e){
    e.preventDefault();if(busy)return;
    setBusy(true);setNotice('');
    try{
      const r=await fetch('/api/auth/email/verify',{method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({email,code})});
      if(!r.ok)throw Error('verify_failed');
      router.replace('/wallet');router.refresh();
    }catch{setNotice('Código incorrecto o vencido. Vuelve a solicitar uno.');}
    setBusy(false);
  }
  return <main className="min-h-screen bg-[#080d16] text-white flex items-center justify-center px-5 py-10">
    <section className="w-full max-w-md">
      <header className="text-center mb-8">
        <Link href="/login" className="inline-flex gap-3 items-center justify-center text-3xl font-extrabold">
          <span className="grid place-items-center rounded-xl bg-cyan-400/15 border border-cyan-300/40 text-cyan-300 w-12 h-12" aria-hidden="true">▶</span>
          Realizo
        </Link>
        <p className="mt-3 text-slate-400">Crea videos con IA. Tus proyectos y créditos, en una sola cuenta.</p>
      </header>
      <div className="p-7 sm:p-9 rounded-3xl bg-[#151b27] border border-white/10 shadow-2xl">
        <h1 className="text-2xl font-bold">Bienvenido a Realizo</h1>
        <p className="mt-2 text-slate-400 text-sm">Inicia sesión o crea tu cuenta.</p>
        {features===null?<p role="status" className="mt-7 text-slate-300">Preparando acceso seguro...</p>:
          !features.enabled?<p role="alert" className="mt-7 border border-amber-300/40 bg-amber-300/10 text-amber-200 rounded-xl p-4 text-sm">
            El registro público todavía no está habilitado. Estamos preparando el inicio de sesión seguro de Realizo.
          </p>:<>
            {features.google&&<button type="button"
              onClick={()=>window.location.assign('/api/auth/google/start')}
              className="mt-7 w-full h-12 bg-white text-slate-950 rounded-xl font-semibold hover:bg-slate-100 flex items-center justify-center gap-3">
              <span className="font-black text-xl" aria-hidden="true">G</span> Continuar con Google
            </button>}
            {features.email&&<>
              {features.google&&<p className="text-center text-slate-500 text-sm my-6">o continúa con correo</p>}
              {step==='email'?<form onSubmit={sendCode} className="mt-6 space-y-4">
                <label htmlFor="realizo-email" className="block text-sm font-medium">Correo electrónico</label>
                <input id="realizo-email" type="email" autoComplete="email" required maxLength={254}
                  className="w-full bg-[#232b3a] rounded-xl px-4 py-3 border border-white/15 outline-none focus:border-cyan-300"
                  placeholder="tu@correo.com" value={email} onChange={e=>setEmail(e.target.value)}/>
                <button disabled={busy} type="submit"
                  className="w-full bg-cyan-400 text-slate-950 rounded-xl py-3 font-bold hover:bg-cyan-300 disabled:opacity-60">
                  {busy?'Enviando...':'Enviar código de acceso'}
                </button>
              </form>:<form onSubmit={verify} className="mt-6 space-y-4">
                <p className="text-sm text-slate-300">Código enviado a <strong>{email}</strong>.</p>
                <label htmlFor="realizo-code" className="block text-sm font-medium">Código de 8 dígitos</label>
                <input id="realizo-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                  pattern="[0-9]{8}" minLength={8} maxLength={8} required
                  className="w-full bg-[#232b3a] rounded-xl px-4 py-3 border border-white/15 outline-none focus:border-cyan-300 tracking-widest"
                  value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/>
                <button disabled={busy} type="submit"
                  className="w-full bg-cyan-400 text-slate-950 rounded-xl py-3 font-bold disabled:opacity-60">Entrar a mi cuenta</button>
                <button type="button" className="text-cyan-300 text-sm underline" onClick={()=>{setStep('email');setCode('');setNotice('')}}>Cambiar correo o pedir otro código</button>
              </form>}
            </>}
            {!features.google&&!features.email&&<p className="text-amber-300 text-sm mt-5">Los métodos de ingreso todavía requieren configuración.</p>}
            {notice&&<p role="status" className="mt-5 text-amber-200 text-sm">{notice}</p>}
          </>}
        <p className="mt-7 text-slate-500 text-xs text-center">Cada cliente tiene su propia billetera y su historial de videos.</p>
      </div>
      {features?.sandbox&&<p className="text-center text-amber-300/80 text-xs mt-5">Entorno Sandbox · No se cobran pagos reales</p>}
    </section>
  </main>;
}
