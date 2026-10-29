'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
const cash = cents=>new Intl.NumberFormat('es-EC',{style:'currency',currency:'USD'}).format((cents||0)/100);
export default function CreateVideoPage(){
  const router=useRouter();
  const [wallet,setWallet]=useState(null),[selected,setSelected]=useState('');
  const [prompt,setPrompt]=useState(''),[imageUrl,setImageUrl]=useState('');
  const [job,setJob]=useState(null),[error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    fetch('/api/wallet',{cache:'no-store',credentials:'same-origin'}).then(async r=>{
      if(r.status===401){router.replace('/login');return null}
      const j=await r.json();
      if(!r.ok)throw Error(j.message||j.error||'No se pudo cargar la billetera');
      return j;
    }).then(j=>{if(active&&j){setWallet(j);setSelected(j.models?.[0]?.model_id||'')}})
      .catch(e=>{if(active)setError(e.message)});
    return ()=>{active=false};
  },[router]);
  const model=wallet?.models?.find(m=>m.model_id===selected);
  async function submit(e){
    e.preventDefault();if(busy||!model||!prompt.trim())return;
    setBusy(true);setError('');
    try{
      const input={prompt:prompt.trim()};
      if(imageUrl.trim())input.image_url=imageUrl.trim();
      const result=await fetch('/api/wallet/generate',{
        method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({model_id:selected,input,idempotency_key:crypto.randomUUID()})
      });
      const json=await result.json();
      if(!result.ok)throw Error(json.error||'No se pudo iniciar la generación');
      setJob(json);
    }catch(e){setError(e.message)}
    setBusy(false);
  }
  async function refresh(){
    if(!job?.job_id)return;
    try{
      const r=await fetch('/api/wallet/jobs/'+encodeURIComponent(job.job_id),{cache:'no-store'});
      const j=await r.json();if(!r.ok)throw Error(j.error||'No se pudo consultar el video');
      setJob(j);
    }catch(e){setError(e.message)}
  }
  return <main className="bg-[#080d16] min-h-screen text-white p-6 md:p-12">
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="flex flex-wrap gap-5 justify-between items-center">
        <div><Link className="text-cyan-300 text-xl font-bold" href="/login">▶ Realizo</Link>
          <h1 className="text-3xl font-bold mt-4">Generar video con IA</h1>
          <p className="text-slate-400 mt-1">Tus generaciones se pagan con los créditos de tu billetera.</p>
        </div>
        <Link className="text-cyan-300 hover:underline" href="/wallet">Mi billetera {wallet?cash(wallet.wallet.available_cents):''}</Link>
      </header>
      <section className="rounded-3xl p-7 bg-white/5 border border-white/10">
        {wallet?.environment==='sandbox'&&<p className="text-amber-300 font-semibold mb-6">Modo de pruebas. La generación con Muapi permanece deshabilitada para no gastar créditos reales.</p>}
        <form onSubmit={submit} className="space-y-6">
          <div><label className="block mb-2 font-semibold" htmlFor="model">Modelo y tarifa del video</label>
            <select id="model" value={selected} onChange={e=>setSelected(e.target.value)}
              className="w-full rounded-xl bg-[#202635] border border-white/20 px-4 py-3" disabled={!wallet?.models?.length}>
              {!wallet?.models?.length?<option value="">No hay modelos habilitados para este entorno</option>:
                wallet.models.map(m=><option key={m.model_id} value={m.model_id}>{m.model_id} — {cash(m.customer_price_cents)}</option>)}
            </select>
          </div>
          <div><label className="block mb-2 font-semibold" htmlFor="prompt">Describe tu video</label>
            <textarea id="prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} rows={5}
              maxLength={6000} required placeholder="Describe la escena, el movimiento, la iluminación y el resultado que esperas."
              className="w-full rounded-xl bg-[#202635] border border-white/20 px-4 py-3 focus:border-cyan-300 outline-none" /></div>
          <div><label className="block mb-2 font-semibold" htmlFor="imageUrl">Imagen de referencia (URL, opcional)</label>
            <input id="imageUrl" type="url" value={imageUrl} onChange={e=>setImageUrl(e.target.value)}
              placeholder="https://..." className="w-full rounded-xl bg-[#202635] border border-white/20 px-4 py-3 focus:border-cyan-300 outline-none" />
            <p className="text-xs text-slate-500 mt-2">Disponible solo para modelos que aceptan imagen de entrada.</p></div>
          <div className="flex flex-wrap gap-3 items-center">
            <button className="bg-cyan-400 text-[#080d16] font-bold rounded-xl px-6 py-3 disabled:opacity-40" type="submit"
              disabled={!model||!wallet||busy||wallet.environment==='sandbox'}>{busy?'Procesando...':model?'Generar video — '+cash(model.customer_price_cents):'Generación no disponible'}</button>
            <Link href="/wallet" className="text-cyan-300 underline">Recargar créditos</Link>
          </div>
        </form>
        {error&&<p role="alert" className="mt-5 text-amber-300">{error}</p>}
        {job&&<section className="mt-6 rounded-xl border border-white/10 p-5 space-y-3">
          <p>Trabajo: <strong>{job.status}</strong></p>
          {job.result?.url&&<a href={job.result.url} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Ver resultado generado</a>}
          {!['completed','failed'].includes(job.status)&&<button onClick={refresh} className="bg-white/15 rounded-lg px-4 py-2">Consultar estado</button>}
        </section>}
      </section>
      <p className="text-slate-500 text-sm">En el lanzamiento habilitaremos variantes con duración, resolución y calidad tarifadas individualmente. Ningún precio se acepta desde el navegador.</p>
    </div>
  </main>;
}
