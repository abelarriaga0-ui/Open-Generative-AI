'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getRealizoBrowserAuth } from '@/lib/realizo-auth/browser';

export default function RealizoLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState('email');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const auth = getRealizoBrowserAuth();
  useEffect(() => {
    if (!auth) return;
    let alive = true;
    auth.auth.getUser().then(({ data, error }) => {
      if (alive && !error && data?.user?.id) router.replace('/wallet');
    });
    return () => { alive = false; };
  }, [auth, router]);

  async function google() {
    if (!auth || busy) return;
    setBusy(true); setNotice('');
    const { error } = await auth.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
    if (error) setNotice('No se pudo iniciar sesión con Google. Inténtalo nuevamente.');
    setBusy(false);
  }

  async function requestEmail(event) {
    event.preventDefault();
    if (!auth || busy) return;
    setBusy(true); setNotice('');
    const { error } = await auth.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (error) setNotice('No fue posible enviar el correo. Verifica la dirección o inténtalo después.');
    else {
      setStage('verify');
      setNotice('Revisa tu correo. Abre el enlace recibido o introduce el código de verificación.');
    }
    setBusy(false);
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!auth || busy) return;
    setBusy(true); setNotice('');
    const { error } = await auth.auth.verifyOtp({
      email: email.trim().toLowerCase(), token: otp.trim(), type: 'email',
    });
    if (error) setNotice('El código no es válido o caducó. Solicita uno nuevo.');
    else router.replace('/wallet');
    setBusy(false);
  }

  return (
    <main className="min-h-screen bg-[#080d16] text-slate-100 flex items-center justify-center px-5 py-12">
      <section className="w-full max-w-md">
        <div className="text-center mb-9">
          <Link href="/" className="inline-flex items-center gap-3 text-3xl font-extrabold tracking-tight">
            <span className="h-11 w-11 bg-cyan-400/15 border border-cyan-400/40 text-cyan-300 grid place-content-center rounded-xl" aria-hidden="true">▶</span>
            Realizo
          </Link>
          <p className="mt-3 text-slate-400">Tus videos, tus creaciones y tu billetera en un solo lugar.</p>
        </div>
        <div className="bg-[#141a25] border border-white/10 rounded-3xl p-7 sm:p-9 shadow-2xl">
          <h1 className="text-2xl font-bold">Bienvenido a Realizo</h1>
          <p className="text-slate-400 text-sm mt-2 mb-8">Inicia sesión o crea tu cuenta para comenzar.</p>
          {!auth ? (
            <div role="status" className="rounded-lg border border-amber-400/40 bg-amber-400/10 text-amber-100 p-4 text-sm">
              El inicio de sesión propio está en preparación. Por seguridad, todavía no se permiten registros ni recargas aquí.
            </div>
          ) : (
            <>
              <button type="button" onClick={google} disabled={busy}
                className="w-full h-12 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-semibold disabled:opacity-50 flex gap-3 items-center justify-center">
                <span aria-hidden="true" className="font-extrabold text-lg">G</span> Continuar con Google
              </button>
              <div className="relative text-center text-slate-500 text-sm my-6">
                <span className="bg-[#141a25] px-3 relative z-10">o continúa con tu correo</span>
                <span className="absolute left-0 right-0 top-1/2 border-t border-white/10" aria-hidden="true" />
              </div>
              {stage === 'email' ? (
                <form onSubmit={requestEmail} className="space-y-4">
                  <label htmlFor="email" className="block text-sm font-medium">Correo electrónico</label>
                  <input id="email" name="email" type="email" autoComplete="email" required maxLength={254}
                    placeholder="nombre@correo.com" value={email} onChange={e=>setEmail(e.target.value)}
                    className="w-full bg-[#222937] border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-cyan-400" />
                  <button type="submit" disabled={busy} className="w-full py-3.5 font-semibold bg-cyan-400 text-slate-950 rounded-xl hover:bg-cyan-300 disabled:opacity-50">
                    {busy ? 'Enviando...' : 'Continuar con correo'}
                  </button>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="space-y-4">
                  <p className="text-slate-300 text-sm">Enviamos un mensaje a <strong>{email}</strong>.</p>
                  <label htmlFor="otp" className="block text-sm font-medium">Código recibido (si tu correo incluye uno)</label>
                  <input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code"
                    pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={otp}
                    onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}
                    className="w-full bg-[#222937] border border-white/15 rounded-xl px-4 py-3 outline-none focus:border-cyan-400 tracking-widest" />
                  <button type="submit" disabled={busy} className="w-full py-3.5 font-semibold bg-cyan-400 text-slate-950 rounded-xl disabled:opacity-50">Validar código</button>
                  <button type="button" className="text-cyan-300 text-sm underline" onClick={()=>{setStage('email');setOtp('');setNotice('');}}>Cambiar correo o solicitar otro enlace</button>
                </form>
              )}
              {notice && <p className="text-sm mt-5 text-amber-200" role="status">{notice}</p>}
            </>
          )}
          <p className="mt-8 text-center text-xs text-slate-500">
            Cuenta personal. Tus saldos y movimientos se mantienen separados de los de otros usuarios.
          </p>
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">Inicio de sesión de Realizo, independiente del panel administrador de Cloudflare.</p>
      </section>
    </main>
  );
}
