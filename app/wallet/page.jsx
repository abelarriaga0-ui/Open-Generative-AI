'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const money = (cents) => new Intl.NumberFormat('es-EC', {
  style: 'currency', currency: 'USD'
}).format((cents || 0) / 100);

export default function WalletPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/wallet', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || json.error || 'No se pudo obtener la billetera');
        setData(json);
      }).catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, []);
  const entryLabels = { deposit: 'Recarga', reserve: 'Generación reservada',
    capture: 'Generación completada', release: 'Reserva devuelta' };
  return (
    <main className="min-h-screen bg-[#080d16] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Mi billetera <span className="text-base font-normal text-cyan-300">USD</span></h1>
          <Link className="text-cyan-300 hover:underline" href="/studio">Volver al estudio</Link>
        </header>
        {error && <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-5">
          <p className="font-semibold">La billetera todavía no está disponible.</p>
          <p className="text-sm text-white/70 mt-2">{error}</p>
          <p className="text-sm text-white/70 mt-2">
            Se requiere configurar la base de datos y el acceso autenticado antes de habilitar las recargas.
          </p>
        </div>}
        {!data && !error && <p className="text-white/65">Consultando tu saldo...</p>}
        {data && <>
          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <p className="text-white/60 text-sm">Saldo disponible</p>
              <p className="mt-2 text-4xl font-bold text-cyan-300">{money(data.wallet.available_cents)}</p>
              <p className="mt-2 text-white/50 text-xs">Saldo de consumo exclusivo de tu cuenta · USD</p>
            </div>
            <div className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <p className="text-white/60 text-sm">Saldo reservado para generaciones</p>
              <p className="mt-2 text-4xl font-bold">{money(data.wallet.reserved_cents)}</p>
              <p className="mt-2 text-white/50 text-xs">Se cobra al completar o se devuelve al fallar</p>
            </div>
          </section>
          <section className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
            <h2 className="text-xl font-semibold">Recargar saldo</h2>
            <p>Recarga mínima: <strong>{money(data.min_topup_cents)}</strong>.
              Después podrás agregar cualquier importe igual o superior al mínimo.</p>
            <button disabled className="bg-cyan-500/30 text-white/60 px-5 py-3 rounded-lg cursor-not-allowed">
              Recargas disponibles próximamente
            </button>
            <p className="text-xs text-white/50">Las recargas internacionales estarán disponibles tras integrar un procesador de pagos autorizado para tu país.</p>
          </section>
          <section className="rounded-2xl bg-white/5 border border-white/10 p-6">
            <h2 className="text-xl font-semibold mb-4">Movimientos recientes</h2>
            {data.activity.length === 0 ? <p className="text-white/60">Todavía no hay movimientos.</p> :
            <ul className="divide-y divide-white/10">
              {data.activity.map((item, index) => (
                <li key={index} className="flex justify-between py-3 gap-3">
                  <span>{entryLabels[item.kind] || item.kind}
                    <small className="block text-white/40">{item.created_at}</small>
                  </span>
                  <strong>{money(item.available_delta_cents)}</strong>
                </li>
              ))}
            </ul>}
          </section>
        </>}
      </div>
    </main>
  );
}
