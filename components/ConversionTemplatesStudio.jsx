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

export default function ConversionTemplatesStudio({ guest = false, onGenerationStart, onGenerationEnd, onGenerationComplete, onGenerationError }) {
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState('premium');
  const [selected, setSelected] = useState(null);
  const [file, setFile] = useState(null);
  const [localPreview, setLocalPreview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [changeDescription, setChangeDescription] = useState('');
  const [analysisSummary, setAnalysisSummary] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [jobId, setJobId] = useState('');
  const [referenceMissing, setReferenceMissing] = useState(false);
  const fileRef = useRef(null);
  const isBusy = phase === 'uploading' || phase === 'analyzing' || phase === 'generating' || phase === 'pending';
  const loadingLabel = phase === 'uploading' ? 'Subiendo producto…' : phase === 'analyzing' ? 'Analizando ajustes…' : phase === 'pending' ? 'Pendiente de conciliación' : 'Creando imagen…';
  const totalPrice = selected && typeof selected.price_cents === 'number' && (!changeDescription.trim() || typeof selected.analysis_price_cents === 'number') ? selected.price_cents + (changeDescription.trim() ? selected.analysis_price_cents : 0) : null;
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
    setAnalysisSummary(null);
    setConfirmed(false);
    if (!next) return setFile(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 10 * 1024 * 1024) {
      setError('Sube una imagen JPG, PNG o WebP de máximo 10 MB.');
      return;
    }
    setFile(next);
  }

  async function pollCompletedJob(id) {
    for (let attempt = 0; attempt < 90; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const res = await fetch('/api/wallet/jobs/' + encodeURIComponent(id), { cache: 'no-store' });
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || 'No fue posible consultar el estado.');
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error('La solicitud falló. Se aplica la política de liberación del saldo.');
      if (job.status === 'unknown') {
        const err = new Error('Solicitud pendiente de conciliación. No solicites otra generación para evitar doble cobro.');
        err.pending = true;
        throw err;
      }
    }
    const err = new Error('La solicitud sigue en proceso. Conserva el identificador para consultar el estado.');
    err.pending = true;
    throw err;
  }

  async function generate() {
    if (!selected || !file || !confirmed || isBusy || !selected.available) return;
    const description = changeDescription.trim();
    if (description && typeof selected.analysis_price_cents !== 'number') {
      setError('El analizador Gemini todavía no tiene precio configurado.');
      return;
    }
    setError('');
    setResultUrl('');
    setJobId('');
    setAnalysisSummary(null);
    onGenerationStart?.();
    try {
      setPhase('uploading');
      const multipart = new FormData();
      multipart.append('product', file);
      const up = await fetch('/api/conversion-templates/upload', { method: 'POST', body: multipart });
      const uploaded = await up.json();
      if (!up.ok || !uploaded.image_url) throw new Error(uploaded.error || 'Error al subir el producto.');
      let analysisId = null;
      if (description) {
        setPhase('analyzing');
        const analysisRequest = await fetch('/api/conversion-templates/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template_id: selected.id,
            description,
            idempotency_key: crypto.randomUUID().replaceAll('-', '')
          })
        });
        const submission = await analysisRequest.json();
        if (!analysisRequest.ok) throw new Error(submission.error || 'No se pudo analizar el cambio.');
        if (!submission.job_id) throw new Error('El análisis no devolvió un identificador.');
        analysisId = submission.job_id;
        setJobId(analysisId);
        if (submission.status === 'unknown') {
          const error = new Error('Análisis en conciliación. No repitas la solicitud.');
          error.pending = true;
          throw error;
        }
        await pollCompletedJob(analysisId);
        const detailResponse = await fetch('/api/conversion-templates/analysis/' +
          encodeURIComponent(analysisId) + '?template_id=' + encodeURIComponent(selected.id), { cache: 'no-store' });
        const analyzed = await detailResponse.json();
        if (!detailResponse.ok) throw new Error(analyzed.error || 'El análisis no pudo validarse.');
        setAnalysisSummary(analyzed);
        if (!analyzed.changes?.length && analyzed.rejected?.length) {
          throw new Error('Los cambios solicitados no están permitidos por esta plantilla. Ajusta tu solicitud para generar.');
        }
      }
      setPhase('generating');
      const submission = await fetch('/api/conversion-templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selected.id,
          product_url: uploaded.image_url,
          claims_confirmed: true,
          analysis_job_id: analysisId,
          idempotency_key: crypto.randomUUID().replaceAll('-', '')
        })
      });
      const data = await submission.json();
      if (!submission.ok) throw new Error(data.error || 'No fue posible generar.');
      if (!data.job_id) throw new Error('No se recibió el identificador de generación.');
      setJobId(data.job_id);
      if (data.status === 'unknown') {
        const error = new Error('Generación en conciliación. No vuelvas a pagar.');
        error.pending = true;
        throw error;
      }
      const completed = await pollCompletedJob(data.job_id);
      const url = getOutputUrl(completed);
      if (!url) throw new Error('El proveedor no devolvió un archivo descargable.');
      setResultUrl(url);
      setPhase('completed');
      onGenerationComplete?.({ url });
    } catch (err) {
      setError(err.message || 'No se pudo generar la imagen.');
      setPhase(err.pending ? 'pending' : 'error');
      onGenerationError?.(err.message);
    } finally {
      onGenerationEnd?.();
    }
  }

  return (
    <section className="realizo-images" aria-label="Imágenes publicitarias de Realizo">
      <div className="realizo-images-heading">
        <div>
          <p className="realizo-images-eyebrow">REALIZO / ESTUDIO DE IMÁGENES</p>
          <h1>Imágenes que <em>venden.</em></h1>
          <p className="realizo-images-subtitle">Elige un diseño, sube tu producto y hazlo tuyo. Sin escribir prompts.</p>
        </div>
        <div className="realizo-images-heading-mark" aria-hidden="true">✳</div>
      </div>

      {!selected ? (
        <>
          <div className="realizo-images-categories" role="group" aria-label="Categorías publicitarias">
            {GROUPS.map((group) => (
              <button type="button" key={group.id} aria-pressed={category===group.id}
                onClick={()=>setCategory(group.id)}
                className={category===group.id ? 'is-active' : ''}>{group.name}</button>
            ))}
          </div>

          <div className="realizo-images-section-header">
            <div><span>COLECCIÓN / {String(GROUPS.findIndex(g=>g.id===category)+1).padStart(2,'0')}</span>
              <h2>{GROUPS.find(g=>g.id===category)?.name}</h2></div>
            <span className="realizo-images-count">{listed.length ? listed.length + (listed.length===1?' diseño':' diseños') : 'Próximamente'}</span>
          </div>

          {listed.length===0 ? (
            <div className="realizo-images-upcoming">
              <span aria-hidden="true">✳</span>
              <h3>Más diseños en camino.</h3>
              <p>Mientras tanto, explora la colección Premium.</p>
              <button type="button" onClick={()=>setCategory('premium')}>Ver diseños premium ↗</button>
            </div>
          ) : (
            <div className="realizo-images-showcase">
              {listed.map((template) => (
                <article className="realizo-images-feature" key={template.id}>
                  <button className="realizo-images-photo" type="button"
                    onClick={()=>{setSelected(template);setError('');setPhase('idle');}}
                    aria-label={'Seleccionar '+template.name}>
                    <img alt={'Diseño '+template.name} src={template.preview_url} loading="eager"
                      onError={()=>setReferenceMissing(true)}/>
                    {referenceMissing&&<span className="realizo-images-missing">Vista previa no disponible</span>}
                    <span className="realizo-images-photo-label">PLANTILLA / 01</span>
                  </button>
                  <div className="realizo-images-feature-copy">
                    <p className="realizo-images-eyebrow">DESTACADA / PREMIUM</p>
                    <h3>{template.name}</h3>
                    <p>Un anuncio de alto impacto con la composición original como referencia. La IA adapta tu envase al diseño seleccionado.</p>
                    <div className="realizo-images-chips"><span>4K</span><span>Diseño de referencia</span><span>Formato vertical</span></div>
                    <button type="button" className="realizo-images-primary"
                      onClick={()=>{setSelected(template);setError('');setPhase('idle');}}>
                      Usar este diseño <span aria-hidden="true">↗</span>
                    </button>
                    <p className="realizo-images-feature-note">Puedes revisar el costo antes de confirmar.</p>
                  </div>
                </article>
              ))}
            </div>
          )}
          {error&&<p className="realizo-images-error" role="alert">{error}</p>}
        </>
      ) : (
        <div className="realizo-images-edit">
          <button className="realizo-images-back" type="button" onClick={()=>{setSelected(null);setError('');setResultUrl('');setPhase('idle');}}>← Explorar diseños</button>
          <div className="realizo-images-workspace">
            <div className="realizo-images-reference">
              <div className="realizo-images-preview">
                <img src={selected.preview_url} alt={'Plantilla original '+selected.name}/>
                <span className="realizo-images-preview-top">REFERENCIA ORIGINAL</span>
              </div>
              <div className="realizo-images-reference-meta">
                <div><strong>{selected.name}</strong><span>Composición protegida</span></div>
                <span>2:3 · 4K</span>
              </div>
            </div>
            <div className="realizo-images-panel">
              <div className="realizo-images-stepper"><span className="is-current">01 Producto</span><i/><span>02 Ajustes</span><i/><span>03 Generar</span></div>
              <h2>Haz que este diseño <em>sea tuyo.</em></h2>
              <p className="realizo-images-panel-intro">Usaremos tu producto como referencia y mantendremos el estilo de la plantilla.</p>

              <div className="realizo-images-form-group">
                <div className="realizo-images-form-head"><span className="realizo-images-number">01</span><label>Fotografía del producto</label><small>Obligatorio</small></div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="realizo-images-visually-hidden"
                  onChange={event=>chooseFile(event.target.files?.[0])}/>
                <button type="button" className={'realizo-images-upload'+(localPreview?' has-image':'')}
                  onClick={()=>fileRef.current?.click()}>
                  {localPreview ? <img src={localPreview} alt="Producto que seleccionaste"/> : <span className="realizo-images-upload-icon" aria-hidden="true">＋</span>}
                  <span><strong>{file ? 'Cambiar fotografía' : 'Seleccionar fotografía'}</strong><small>{file?.name || 'PNG, JPG o WebP · Hasta 10 MB'}</small></span>
                  <span className="realizo-images-upload-arrow" aria-hidden="true">↗</span>
                </button>
              </div>

              <div className="realizo-images-form-group">
                <div className="realizo-images-form-head"><span className="realizo-images-number">02</span><label htmlFor="realizo-optional-changes">¿Algún cambio adicional?</label><small>Opcional</small></div>
                <textarea id="realizo-optional-changes" rows={3} maxLength={1200} value={changeDescription}
                  onChange={event=>{setChangeDescription(event.target.value);setAnalysisSummary(null);}}
                  placeholder="Ej. Cambiar «Sabor vainilla» por «Sabor chocolate». Dejar todo lo demás igual."/>
                <p className="realizo-images-assist">La IA interpretará tus ajustes. El fondo, la persona y la composición permanecen protegidos.</p>
              </div>

              <label className="realizo-images-confirmation">
                <input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>
                <span>Confirmo que los beneficios escritos en esta plantilla corresponden a mi producto, salvo los textos que pedí modificar.</span>
              </label>

              <div className="realizo-images-checkout">
                <div>
                  <span className="realizo-images-total-label">Total antes de generar</span>
                  <strong>{money(totalPrice)}</strong>
                  <small>{changeDescription.trim() ? 'Incluye análisis de cambios y creación 4K' : 'Creación de imagen en 4K'} · Descuento de tu saldo</small>
                </div>
                {guest ? (
                  <a className="realizo-images-primary" href="/login">Iniciar sesión <span aria-hidden="true">↗</span></a>
                ) : (
                  <button type="button" className="realizo-images-primary" onClick={generate}
                    disabled={!selected.available||!file||!confirmed||isBusy||(Boolean(changeDescription.trim())&&typeof selected.analysis_price_cents!=='number')}>
                    {isBusy ? loadingLabel : 'Generar imagen'} <span aria-hidden="true">↗</span>
                  </button>
                )}
              </div>

              {!selected.available && <p className="realizo-images-notice">Este diseño no está disponible para generar en este momento.</p>}
              {analysisSummary && (
                <div className="realizo-images-analysis">
                  <strong>Ajustes analizados</strong>
                  {(analysisSummary.changes||[]).map(c=><p key={c.field}>{c.original} → {c.text}</p>)}
                  {(analysisSummary.rejected||[]).map((message,i)=><p className="is-rejected" key={i}>No aplicado: {message}</p>)}
                </div>
              )}
              {error && <p className="realizo-images-error" role="alert">{error}</p>}
              {jobId&&<p className="realizo-images-job">Solicitud: {jobId}</p>}
              {resultUrl && (
                <div className="realizo-images-result">
                  <h3>Tu imagen está lista.</h3>
                  <img src={resultUrl} alt="Imagen adaptada con tu producto"/>
                  <a href={resultUrl} target="_blank" rel="noopener noreferrer">Ver y descargar imagen ↗</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
