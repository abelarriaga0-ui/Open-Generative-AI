'use client';

import { useEffect, useRef, useState } from 'react';

const GROUPS = [
  { id: 'premium', name: 'Premium', detail: 'Anuncios de alto impacto' },
  { id: 'ofertas', name: 'Ofertas y precios', detail: 'Promociones y venta directa' },
  { id: 'problema', name: 'Problema y solución', detail: 'Beneficios visuales' },
  { id: 'contexto', name: 'Producto en contexto', detail: 'Uso real y escenarios' },
  { id: 'carruseles', name: 'Carruseles', detail: 'Historias que convierten' },
];

const money = (cents) => typeof cents === 'number'
  ? new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(cents / 100)
  : 'Precio por configurar';

function getOutputUrl(result) {
  const payload = result?.result || {};
  const outputs = payload.outputs;
  const first = Array.isArray(outputs) ? outputs[0] : null;
  return (typeof first === 'string' ? first : first?.url) ||
    (typeof payload.output === 'string' ? payload.output : payload.output?.url) ||
    payload.url || null;
}

export default function ConversionTemplatesStudio({ onGenerationStart, onGenerationEnd, onGenerationComplete, onGenerationError }) {
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState('premium');
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [referenceMissing, setReferenceMissing] = useState(false);
  const fileRef = useRef(null);
  const isBusy = phase === 'uploading' || phase === 'generating';
  const listed = templates.filter((item) => item.category === category);

  useEffect(() => {
    let active = true;
    fetch('/api/conversion-templates', { cache: 'no-store' })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('No se pudo cargar el catálogo.')))
      .then((data) => { if (active) setTemplates(data.templates || []); })
      .catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!file) { setLocalPreview(null); return; }
    const url = URL.createObjectURL(file);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function chooseFile(next) {
    setError('');
    setResultUrl('');
    setConfirmed(false);
    if (!next) return setFile(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 10 * 1024 * 1024) {
      setError('Sube una imagen JPG, PNG o WebP de máximo 10 MB.');
      return;
    }
    setFile(next);
  }

  async function generate() {
    if (!selected || !file || !confirmed || isBusy || !selected.available) return;
    setError('');
    setResultUrl('');
    setJobId('');
    onGenerationStart?.();
    try {
      setPhase('uploading');
      const multipart = new FormData();
      multipart.append('product', file);
      const up = await fetch('/api/conversion-templates/upload', { method: 'POST', body: multipart });
      const uploaded = await up.json();
      if (!up.ok || !uploaded.image_url) throw new Error(uploaded.error || 'Error al subir el producto.');
      setPhase('generating');
      const nonce = crypto.randomUUID().replaceAll('-', '');
      const submission = await fetch('/api/conversion-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selected.id,
          product_url: uploaded.image_url,
          claims_confirmed: true,
          idempotency_key: nonce
        })
      });
      const data = await submission.json();
      if (!submission.ok) throw new Error(data.error || 'No fue posible generar.');
      if (!data.job_id) throw new Error('No se recibió el identificador de generación.');
      setJobId(data.job_id);
      if (data.status === 'unknown') {
        setPhase('pending');
        throw new Error('Solicitud en conciliación. No se volvió a cobrar.');
      }
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const poll = await fetch('/api/wallet/jobs/' + encodeURIComponent(data.job_id), { cache: 'no-store' });
        const state = await poll.json();
        if (!poll.ok) throw new Error(state.error || 'No fue posible comprobar el resultado.');
        if (state.status === 'completed') {
          const url = getOutputUrl(state);
          if (!url) throw new Error('La generación terminó sin un archivo descargable.');
          setResultUrl(url);
          setPhase('completed');
          onGenerationComplete?.({ url });
          return;
        }
        if (state.status === 'failed') throw new Error('El proveedor no pudo completar la imagen; se aplica la política de devolución.');
        if (state.status === 'unknown') throw new Error('Solicitud pendiente de conciliación. Guarda el identificador.');
      }
      setPhase('pending');
      throw new Error('La generación continúa; guarda el identificador para revisar el estado.');
    } catch (err) {
      setError(err.message || 'No se pudo generar la imagen.');
      if (phase !== 'pending') setPhase('error');
      onGenerationError?.(err.message);
    } finally {
      onGenerationEnd?.();
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#07090d] px-4 py-7 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.27em] text-teal-300">REALIZO · Creativos</p>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-4xl">Imágenes que venden</h1>
            <p className="mt-2 text-sm text-white/55">Elige un diseño, sube tu producto y genera.</p>
          </div>
          <a href="/wallet" className="rounded-xl border border-white/15 px-4 py-3 text-sm text-white/80 hover:bg-white/5">Mi billetera</a>
        </div>

        <div className="mb-7 flex flex-wrap gap-2" aria-label="Categorías de imágenes">
          {GROUPS.map((group) => (
            <button key={group.id} type="button" onClick={() => { setCategory(group.id); setSelected(null); }}
              className={'rounded-full border px-4 py-2 text-sm transition ' +
                (category === group.id ? 'border-teal-400 bg-teal-400/15 text-teal-200' : 'border-white/10 bg-white/5 text-white/60 hover:border-white/30')}>
              {group.name}
            </button>
          ))}
        </div>

        {!selected ? (
          <div>
            <h2 className="mb-4 text-lg font-semibold">{GROUPS.find((group) => group.id === category)?.detail}</h2>
            {listed.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
                Más plantillas próximamente.
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {listed.map((template) => (
                  <article key={template.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#12151c]">
                    <div className="relative aspect-[2/3] max-h-[410px] overflow-hidden bg-gradient-to-br from-blue-950 via-blue-700 to-blue-950">
                      <img src={template.preview_url} alt={template.name} onError={() => setReferenceMissing(true)}
                        className="h-full w-full object-cover" />
                      {referenceMissing && <div className="absolute inset-0 flex items-center justify-center p-8 text-center font-semibold">Plantilla: Explosión Premium Azul</div>}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div><h3 className="font-semibold">{template.name}</h3><p className="text-xs text-white/50">Vertical · Fidelidad estricta</p></div>
                        <span className="text-sm font-semibold text-teal-300">{money(template.price_cents)}</span>
                      </div>
                      <button type="button" onClick={() => { setSelected(template); setError(''); }}
                        className="w-full rounded-xl bg-teal-300 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-teal-200">
                        Usar plantilla
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
            <div className="space-y-3">
              <button onClick={() => setSelected(null)} className="text-sm text-white/60 hover:text-white">← Volver a plantillas</button>
              <div className="mx-auto max-w-md overflow-hidden rounded-2xl border border-white/10 bg-blue-900">
                <img src={selected.preview_url} alt="Diseño de referencia" className="w-full" />
              </div>
              <p className="text-center text-xs text-white/50">Plantilla visual de referencia, no una composición nueva.</p>
            </div>
            <section className="self-start rounded-2xl border border-white/10 bg-[#12151c] p-5 md:p-7">
              <h2 className="text-xl font-bold">{selected.name}</h2>
              <p className="mb-6 mt-1 text-sm text-white/55">Solo reemplazaremos el producto central, conservando el resto del diseño lo más fielmente posible.</p>
              <div className="mb-4 rounded-xl border border-dashed border-white/20 p-5">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(event) => chooseFile(event.target.files?.[0])} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 text-center">
                  {localPreview ? <img src={localPreview} alt="Producto cargado" className="max-h-48 max-w-full rounded-lg object-contain" />
                    : <span className="text-3xl">＋</span>}
                  <span className="text-sm font-semibold">{file ? 'Cambiar producto' : 'Subir foto de mi producto'}</span>
                  <span className="text-xs text-white/45">JPG, PNG o WebP · Máximo 10 MB</span>
                </button>
              </div>
              <label className="mb-6 flex items-start gap-3 text-xs text-white/65">
                <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-0.5 accent-teal-300" />
                <span>Confirmo que mi producto cumple los beneficios nutricionales escritos en esta plantilla. Solo cambiará el envase.</span>
              </label>
              <div className="mb-4 flex items-center justify-between border-t border-white/10 pt-4 text-sm">
                <span className="text-white/60">Costo de generación</span>
                <strong className="text-lg text-teal-300">{money(selected.price_cents)}</strong>
              </div>
              {!selected.available && (
                <p className="mb-4 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">
                  Plantilla visible en modo de configuración. Aún no se ha habilitado el modelo, el precio y la referencia pública.
                </p>
              )}
              <button type="button" onClick={generate}
                disabled={!selected.available || !confirmed || !file || isBusy}
                className="w-full rounded-xl bg-teal-300 px-5 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
                {isBusy ? (phase === 'uploading' ? 'Subiendo producto…' : 'Generando imagen…') : 'Generar imagen'}
              </button>
              {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
              {jobId && <p className="mt-2 break-all text-xs text-white/35">Solicitud: {jobId}</p>}
              {resultUrl && <div className="mt-5 space-y-3">
                <img src={resultUrl} alt="Imagen generada" className="w-full rounded-xl" />
                <a href={resultUrl} target="_blank" rel="noopener noreferrer"
                  className="block rounded-xl border border-teal-300/60 px-4 py-3 text-center text-sm font-semibold text-teal-200">
                  Abrir imagen para descargar
                </a>
              </div>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
