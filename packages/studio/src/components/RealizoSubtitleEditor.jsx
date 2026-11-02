import React,{useState} from 'react';
import {scriptFromPrompt} from '../../../../lib/realizo-creative/subtitle-timeline.js';
import {renderSubtitledVideo,sourceVideoBlob,supportedSubtitleFormat} from '../../../../lib/realizo-creative/subtitle-render-client.js';

// Free optional post-generation enhancement. Nothing is charged and the source
// MP4 remains untouched. Rendering is done entirely in the customer's browser.
export default function RealizoSubtitleEditor({videoUrl,spokenScript='',prompt='',filename='realizo',onClose}){
 const [script,setScript]=useState(spokenScript||scriptFromPrompt(prompt));
 const [file,setFile]=useState(null);
 const [progress,setProgress]=useState(0);
 const [working,setWorking]=useState(false);
 const [error,setError]=useState('');
 const [completed,setCompleted]=useState(null);
 const [offset,setOffset]=useState(0);
 const format=typeof window==='undefined'?null:supportedSubtitleFormat();
 const run=async()=>{
  if(working)return;
  if(script.trim().length<4){
   setError('Escribe o pega el diálogo del video antes de generar los subtítulos.');return;
  }
  setWorking(true);setError('');setProgress(0);setCompleted(null);
  try{
   const source=await sourceVideoBlob(videoUrl,{file});
   const result=await renderSubtitledVideo({
    source,script:script.trim(),offset,onProgress:setProgress,
   });
   const downloadUrl=URL.createObjectURL(result.blob);
   setCompleted({url:downloadUrl,extension:result.extension});
  }catch(e){setError(e?.message||'No fue posible añadir los subtítulos. No se realizó ningún cobro.');}
  finally{setWorking(false)}
 };
 const safeName=String(filename).replace(/[^a-z0-9_-]/gi,'-').slice(0,65);
 return <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={e=>{if(!working&&e.target===e.currentTarget)onClose();}}>
  <div role="dialog" aria-modal="true" aria-label="Agregar subtítulos al video" className="w-full max-w-xl rounded-3xl bg-white text-[#2B2240] p-5 sm:p-7 space-y-4 shadow-2xl max-h-[94vh] overflow-y-auto">
   <div className="flex justify-between items-start gap-3">
    <div>
     <h2 className="text-xl font-bold">Agregar subtítulos</h2>
     <p className="text-sm text-[#776685] mt-1">Gratis por ahora · sin API adicional · tu video original se conserva.</p>
    </div>
    <button type="button" aria-label="Cerrar" onClick={onClose} disabled={working} className="text-2xl px-2 disabled:opacity-40">×</button>
   </div>
   <label className="block text-sm font-semibold" htmlFor="realizo-subtitle-dialogue">Texto que se escucha en el video</label>
   <textarea id="realizo-subtitle-dialogue" value={script} rows={4}
     placeholder="Pega lo que dice la voz. Si viene de REALIZO se completa con el guion original."
     onChange={e=>{setScript(e.target.value);setCompleted(null)}}
     className="w-full rounded-xl border border-[#D7CBE5] p-3 text-sm outline-none focus:border-[#8A5BCF]" maxLength={3800}/>
   <p className="text-xs text-[#846F93]">
    La sincronización se calcula con el guion y las partes sonoras del video. No es transcripción palabra por palabra: si el motor cambió lo que dijo, corrige el texto aquí.
   </p>
   <div className="flex gap-3 items-center text-sm flex-wrap">
    <label htmlFor="realizo-subtitle-offset" className="font-semibold">Ajuste de tiempo</label>
    <input id="realizo-subtitle-offset" type="range" min="-2" max="2" step="0.1" value={offset}
      onChange={e=>setOffset(Number(e.target.value))} disabled={working}/>
    <span>{offset>0?'+':''}{offset.toFixed(1)} s</span>
   </div>
   <label className="text-xs block text-[#786887]">
    Si el proveedor no permite leer el video directamente, selecciona aquí el MP4 original descargado:
    <input type="file" accept="video/*" disabled={working}
      onChange={e=>setFile(e.target.files?.[0]||null)}
      className="mt-2 block w-full text-sm"/>
   </label>
   {error&&<p role="alert" className="text-sm text-[#A12D37]">{error}</p>}
   {working&&<p role="status" className="text-sm font-semibold text-[#7045BB]">Procesando localmente: {progress}% · mantén esta pestaña abierta y visible.</p>}
   {!format&&<p className="text-sm text-[#A12D37]">Tu navegador no admite exportación local de video. Usa Chrome o Edge actualizado.</p>}
   <div className="flex gap-2 flex-wrap">
    <button type="button" disabled={working||!format||script.trim().length<4} onClick={run}
      className="rounded-xl bg-[#704BC4] text-white px-5 py-3 text-sm font-bold disabled:opacity-40">
      {working?'Preparando video…':'Generar subtítulos gratis'}
    </button>
    {completed&&<a href={completed.url} download={safeName+'-subtitulado.'+completed.extension}
      className="rounded-xl bg-[#F0E9FC] text-[#6237AD] px-5 py-3 text-sm font-bold">
      Descargar video subtitulado ({completed.extension.toUpperCase()})
    </a>}
   </div>
   <p className="text-xs text-[#8A8094]">La exportación depende de tu navegador. Puede producir MP4 o WebM. No consume créditos y no modifica el original.</p>
  </div>
 </div>;
}
