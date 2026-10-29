'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function BrandMark({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="realizo-signin-mark" x1="2" y1="7" x2="52" y2="52">
          <stop stopColor="#FF987B" />
          <stop offset=".53" stopColor="#F469A6" />
          <stop offset="1" stopColor="#A279FF" />
        </linearGradient>
      </defs>
      <rect width="56" height="56" rx="18" fill="url(#realizo-signin-mark)" />
      <path d="M19 14.5v27l23-13.5L19 14.5Z" fill="#261C3C" />
      <path d="M21.7 20.2 35 28l-13.3 7.8V20.2Z" fill="#FFF6EF" />
      <circle cx="43" cy="13" r="4.5" fill="#C6FFCB" />
    </svg>
  );
}
function GoogleSymbol() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.23-.2-1.78H12v3.57h5.5a4.67 4.67 0 0 1-2.04 3.06v2.54h3.3c1.92-1.78 2.84-4.4 2.84-7.39Z" />
      <path fill="#34A853" d="M12 22c2.75 0 5.04-.91 6.72-2.38l-3.3-2.54c-.91.6-2.06.96-3.42.96-2.62 0-4.84-1.77-5.63-4.16H2.97v2.62A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.37 13.88a5.92 5.92 0 0 1 0-3.76V7.5h-3.4a10 10 0 0 0 0 9l3.4-2.62Z" />
      <path fill="#EA4335" d="M12 5.96c1.46 0 2.77.5 3.8 1.49l2.92-2.92A9.92 9.92 0 0 0 12 2a10 10 0 0 0-9.03 5.5l3.4 2.62C7.16 7.73 9.38 5.96 12 5.96Z" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15m-6-6 6 6-6 6" />
    </svg>
  );
}
const inputStyle = 'block w-full rounded-2xl border border-[#DDD7D0] bg-white/90 px-4 py-3.5 text-[15px] text-[#251D37] placeholder:text-[#9A93A5] outline-none transition focus:border-[#9763DD] focus:ring-4 focus:ring-[#9763DD]/10 disabled:cursor-not-allowed disabled:opacity-55';
const submitStyle = 'flex w-full items-center justify-center gap-3 rounded-2xl bg-[#6E4BD2] px-5 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[#5E3BC4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E4BD2] disabled:cursor-not-allowed disabled:opacity-45';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('email');
  const [features, setFeatures] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/api/auth/features', { cache: 'no-store' }).then(response => {
        if (!response.ok) throw new Error('features_unavailable');
        return response.json();
      }),
      fetch('/api/auth/me', { cache: 'no-store' }).then(response => response.json()),
    ]).then(([flags, session]) => {
      if (!active) return;
      setFeatures(flags);
      if (session.authenticated) router.replace('/studio');
    }).catch(() => {
      if (active) setFeatures({ enabled: false, email: false, google: false });
    });
    return () => { active = false; };
  }, [router]);

  const canGoogle = Boolean(features?.enabled && features?.google);
  const canEmail = Boolean(features?.enabled && features?.email);
  const isReady = canGoogle || canEmail;

  async function sendCode(event) {
    event.preventDefault();
    if (!canEmail || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/auth/email/start', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) throw new Error('send_failed');
      setStage('code');
      setNotice('Código enviado. Revisa tu correo.');
    } catch {
      setNotice('No se pudo enviar el código.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!canEmail || busy) return;
    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/auth/email/verify', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (!response.ok) throw new Error('invalid_code');
      router.replace('/studio');
      router.refresh();
    } catch {
      setNotice('Código incorrecto o vencido.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F3EE] text-[#251D37]">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
        <section
          className="relative hidden min-h-[720px] overflow-hidden bg-[#261E3F] px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16"
          style={{ backgroundImage: 'radial-gradient(ellipse at 10% 10%, rgba(177,113,242,.24), transparent 46%), radial-gradient(ellipse at 83% 80%, rgba(245,113,130,.19), transparent 45%)' }}
        >
          <div className="relative z-10 flex items-center gap-3">
            <BrandMark size={46} />
            <span className="text-[27px] font-extrabold tracking-tight">realizo<span className="text-[#FFAD91]">.</span></span>
          </div>
          <div className="relative z-10 max-w-[530px]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[.2em] text-[#E2D1FE]">
              <span className="h-2 w-2 rounded-full bg-[#BDF9CD]" />
              Video + inteligencia artificial
            </div>
            <h2 className="text-5xl font-extrabold leading-[1.06] tracking-[-.045em] xl:text-6xl">
              Tus ideas,<br />
              <span className="text-[#FFAE9C]">en movimiento.</span>
            </h2>
            <div className="relative mt-12 h-[300px] max-w-[475px]" aria-hidden="true">
              <div className="absolute left-4 top-3 h-[232px] w-[74%] rotate-[-10deg] rounded-[28px] border border-white/20 bg-[#7051C0] shadow-[0_20px_60px_rgba(0,0,0,.2)]" />
              <div className="absolute left-16 top-7 h-[232px] w-[76%] rotate-[7deg] rounded-[28px] border border-white/20 bg-[#F58983] shadow-[0_25px_75px_rgba(0,0,0,.3)]">
                <div className="absolute inset-x-4 top-4 flex items-center justify-between">
                  <span className="rounded-full bg-[#271D39]/15 px-3 py-1 text-[11px] font-bold tracking-wider text-[#39233D]">SCENE 01</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#FFF8D2]" />
                </div>
                <div className="absolute bottom-0 left-7 h-[72%] w-[78%] overflow-hidden rounded-t-[130px] bg-[#FFD7B4]">
                  <div className="absolute -left-9 bottom-[-25px] h-[158px] w-[158px] rounded-full bg-[#A79CF4]" />
                  <div className="absolute -right-8 bottom-[-18px] h-[138px] w-[138px] rounded-full bg-[#EFAA65]" />
                  <div className="absolute left-[28%] top-[-12px] h-[125px] w-[125px] rotate-[-26deg] rounded-[45px] bg-[#49366E]" />
                </div>
                <div className="absolute left-1/2 top-[53%] grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/70 bg-white/85 shadow-lg backdrop-blur-sm">
                  <svg width="29" height="29" viewBox="0 0 24 24" fill="#6044AD"><path d="M8 4.8 20 12 8 19.2V4.8Z"/></svg>
                </div>
              </div>
              <div className="absolute bottom-1 left-7 right-5 flex items-center gap-3 rounded-[20px] border border-white/25 bg-[#3F315C]/95 p-4 shadow-xl backdrop-blur">
                <span className="rounded-xl bg-[#A891F3] p-2.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#27203D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18M3 12h18M3 17h18"/></svg>
                </span>
                <span className="flex flex-1 gap-1.5">
                  {[40,66,56,88,45,76,60,34,72,50,84,38].map((height, index) => (
                    <span key={index} className="flex-1 rounded-full bg-[#D7C7FB]" style={{height: height * .38 + 'px'}} />
                  ))}
                </span>
                <span className="text-xs font-medium text-[#EEE4FF]">00:12</span>
              </div>
            </div>
          </div>
          <p className="relative z-10 text-sm font-medium tracking-wide text-[#CDBEE4]">Imagina · Crea · Comparte</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-[430px]">
            <div className="mb-11 flex items-center gap-2.5 lg:hidden">
              <BrandMark size={42} />
              <span className="text-2xl font-extrabold tracking-tight text-[#281F3E]">realizo<span className="text-[#EB765F]">.</span></span>
            </div>

            <div className="mb-9">
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E9DDFE] text-[#6844B8]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 4v16m-8-8h16" />
                  <path d="M7.2 7.2 16.8 16.8M16.8 7.2l-9.6 9.6" opacity=".55"/>
                </svg>
              </div>
              <h1 className="text-[34px] font-extrabold leading-tight tracking-[-.045em] sm:text-[40px]">
                Tu espacio creativo.
              </h1>
              <p className="mt-2 text-[15px] text-[#857B91]">Inicia sesión o crea tu cuenta.</p>
            </div>

            <div className="space-y-5">
              <button type="button" onClick={() => window.location.assign('/api/auth/google/start')}
                disabled={!canGoogle || busy}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#DCD4D0] bg-white px-5 py-3.5 text-[15px] font-semibold text-[#292039] shadow-[0_3px_10px_rgba(44,27,63,.035)] transition hover:border-[#B7A7C8] hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6E4BD2] disabled:cursor-not-allowed disabled:opacity-55">
                <GoogleSymbol />
                Continuar con Google
              </button>
              <div className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[.14em] text-[#A69CAB]">
                <span className="h-px flex-1 bg-[#E4DDD9]" />
                <span>o con correo</span>
                <span className="h-px flex-1 bg-[#E4DDD9]" />
              </div>
              {stage === 'email' ? (
                <form onSubmit={sendCode} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="realizo-email" className="block text-sm font-semibold">Correo electrónico</label>
                    <input id="realizo-email" name="email" type="email" autoComplete="email"
                      maxLength={254} required value={email} placeholder="tu@correo.com"
                      disabled={!canEmail || busy} onChange={event => setEmail(event.target.value)}
                      className={inputStyle} />
                  </div>
                  <button type="submit" className={submitStyle} disabled={!canEmail || busy}>
                    {busy ? 'Enviando…' : 'Continuar'} {!busy && <ArrowIcon />}
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="space-y-4">
                  <p className="text-sm text-[#786B83]">{email}</p>
                  <div className="space-y-2">
                    <label htmlFor="realizo-code" className="block text-sm font-semibold">Código de verificación</label>
                    <input id="realizo-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
                      pattern="[0-9]{8}" minLength={8} maxLength={8} required
                      value={code} disabled={!canEmail || busy} onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                      className={inputStyle + ' tracking-[.16em]'} />
                  </div>
                  <button type="submit" className={submitStyle} disabled={!canEmail || busy}>
                    {busy ? 'Verificando…' : 'Entrar'} {!busy && <ArrowIcon />}
                  </button>
                  <button type="button" className="text-sm font-semibold text-[#6E4BD2] hover:underline"
                    onClick={() => { setStage('email'); setCode(''); setNotice(''); }}>Cambiar correo</button>
                </form>
              )}

              {notice && <p role="status" className="rounded-xl bg-[#F2E8F8] px-4 py-3 text-sm text-[#6E4BD2]">{notice}</p>}
              {features !== null && !isReady && (
                <p role="status" className="flex items-center justify-center gap-2 pt-1 text-xs text-[#8B8190]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#E4A16E]" aria-hidden="true" />
                  Acceso en preparación
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
