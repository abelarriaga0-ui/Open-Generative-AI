import {createSubtitleTimeline,detectAudioActivity} from './subtitle-timeline.js';

const wait=(element,event,timeout=25000)=>new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>{cleanup();reject(Error('No se pudo cargar el video.'));},timeout);
 const handler=()=>{cleanup();resolve();};
 const fail=()=>{cleanup();reject(Error('El video no se puede reproducir.'));};
 const cleanup=()=>{clearTimeout(timer);element.removeEventListener(event,handler);element.removeEventListener('error',fail);};
 element.addEventListener(event,handler,{once:true});
 element.addEventListener('error',fail,{once:true});
});
export function supportedSubtitleFormat(){
 if(typeof MediaRecorder==='undefined')return null;
 const types=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4',
  'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
 return types.find(t=>MediaRecorder.isTypeSupported(t))||null;
}
export async function sourceVideoBlob(url,{file}={}){
 if(file){
  if(!file.type.startsWith('video/') || file.size>220*1024*1024)
   throw Error('Selecciona un video compatible de máximo 220 MB.');
  return file;
 }
 if(!/^https:\/\//i.test(String(url||'')))throw Error('No hay un video disponible.');
 let response;
 try{response=await fetch(url,{mode:'cors',credentials:'omit',redirect:'follow'});}
 catch{throw Error('El proveedor no permite descargar el video desde el navegador. Descarga el original y selecciónalo aquí para añadir subtítulos gratis.');}
 if(!response.ok)throw Error('No se pudo descargar el video original.');
 const declared=Number(response.headers.get('content-length')||0);
 if(declared>220*1024*1024)throw Error('El video supera 220 MB. Usa un archivo más corto.');
 const blob=await response.blob();
 if(blob.size>220*1024*1024)throw Error('El video supera el tamaño admitido.');
 return blob;
}
function captionAt(cues,time){
 return cues.find(c=>time>=c.start&&time<c.end)?.text||'';
}
function drawCaptions(ctx,w,h,text){
 if(!text)return;
 const words=text.split(/\s+/).filter(Boolean);
 const size=Math.round(Math.max(24,Math.min(62,w*0.054)));
 const maxWidth=w*0.86;
 ctx.font='800 '+size+'px system-ui,Arial,sans-serif';
 const rows=[];let line='';
 for(const word of words){
  const attempt=line?line+' '+word:word;
  if(ctx.measureText(attempt).width>maxWidth && line){rows.push(line);line=word;}
  else line=attempt;
 }
 if(line)rows.push(line);
 const lines=rows.slice(0,3);
 const y=Math.round(h*0.79);
 const lineHeight=size*1.27;
 const blockH=lines.length*lineHeight;
 const rectY=y-blockH-size*0.48,rectX=w*0.06;
 ctx.fillStyle='rgba(9,9,20,0.76)';
 ctx.beginPath();
 if(typeof ctx.roundRect==='function')ctx.roundRect(rectX,rectY,w*0.88,blockH+size*0.38,14);
 else ctx.rect(rectX,rectY,w*0.88,blockH+size*0.38);
 ctx.fill();
 ctx.textAlign='center';
 ctx.textBaseline='middle';
 ctx.lineJoin='round';
 for(let i=0;i<lines.length;i++){
  const cy=rectY+size*0.19+lineHeight*(i+0.52);
  ctx.lineWidth=Math.max(3,size*0.095);
  ctx.strokeStyle='#08070B';
  ctx.strokeText(lines[i],w/2,cy);
  ctx.fillStyle='#FFFFFF';
  ctx.fillText(lines[i],w/2,cy);
 }
}
export async function renderSubtitledVideo({source,script,offset=0,onProgress=()=>{},signal}={}){
 if(!source || source.size>220*1024*1024)throw Error('Video no disponible o demasiado grande.');
 const mime=supportedSubtitleFormat();
 if(!mime)throw Error('Tu navegador no admite exportar videos localmente. Usa Chrome o Edge actualizado.');
 if(typeof document==='undefined')throw Error('Esta función requiere un navegador.');
 const objectUrl=URL.createObjectURL(source);
 const video=document.createElement('video');
 video.src=objectUrl;video.preload='auto';video.playsInline=true;video.muted=false;
 video.crossOrigin='anonymous';
 let ac=null,stream=null,recorder=null,raf=0,stopRequested=false;
 try{
  video.load();
  await wait(video,'loadedmetadata');
  const duration=Number(video.duration);
  if(!Number.isFinite(duration)||duration<1||duration>121)throw Error('Solo se admiten videos de 1 a 120 segundos.');
  const ratio=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(2,Math.round(video.videoWidth*ratio/2)*2);
  canvas.height=Math.max(2,Math.round(video.videoHeight*ratio/2)*2);
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx||typeof canvas.captureStream!=='function')throw Error('Este navegador no admite procesamiento de video local.');
  // Decode existing audio solely for estimating the timing of speech. No API.
  let ranges=[];
  try{
   ac=new (window.AudioContext||window.webkitAudioContext)();
   const audioBytes=await source.arrayBuffer();
   const decoded=await ac.decodeAudioData(audioBytes.slice(0));
   ranges=detectAudioActivity(decoded);
  }catch{/* MP4 can be decoded for playback but not via decodeAudioData. */}
  const cues=createSubtitleTimeline(script,duration,{speechRanges:ranges,offset});
  if(!cues.length)throw Error('Escribe el texto hablado del video para sincronizar los subtítulos.');
  ac=ac||new (window.AudioContext||window.webkitAudioContext)();
  const media=ac.createMediaElementSource(video);
  const output=ac.createMediaStreamDestination();
  media.connect(output); // Do NOT connect to speakers, avoids echo.
  const videoStream=canvas.captureStream(24);
  stream=new MediaStream([...videoStream.getVideoTracks(),...output.stream.getAudioTracks()]);
  const chunks=[];
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3000000,audioBitsPerSecond:128000});
  const saved=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data);};
   recorder.onerror=()=>reject(Error('No se pudo exportar el video subtitulado.'));
   recorder.onstop=()=>resolve(new Blob(chunks,{type:mime.split(';')[0]}));
  });
  const paint=()=>{
   ctx.drawImage(video,0,0,canvas.width,canvas.height);
   drawCaptions(ctx,canvas.width,canvas.height,captionAt(cues,video.currentTime));
   onProgress(Math.min(98,Math.floor(video.currentTime/duration*100)));
   if(!video.ended&&!stopRequested)raf=requestAnimationFrame(paint);
  };
  // The recording is real-time so audio remains paired with video frames.
  video.currentTime=0;
  await ac.resume();
  paint();
  recorder.start(1000);
  await video.play();
  await new Promise((resolve,reject)=>{
   const finish=()=>{clearTimeout(timeout);resolve();};
   const abort=()=>{clearTimeout(timeout);reject(Error('Exportación cancelada.'));};
   const timeout=setTimeout(()=>{stopRequested=true;abort();},Math.ceil(duration*1000)+12000);
   video.addEventListener('ended',finish,{once:true});
   if(signal){
    if(signal.aborted)abort();
    else signal.addEventListener('abort',abort,{once:true});
   }
  });
  stopRequested=true;
  cancelAnimationFrame(raf);
  paint();
  recorder.stop();
  const blob=await saved;
  if(blob.size<1500)throw Error('El navegador no produjo un video válido.');
  onProgress(100);
  return {blob,extension:mime.startsWith('video/mp4')?'mp4':'webm',approximate:true};
 } finally {
  stopRequested=true;cancelAnimationFrame(raf);video.pause();video.removeAttribute('src');
  video.load();stream?.getTracks().forEach(t=>t.stop());
  if(recorder?.state==='recording')recorder.stop();
  if(ac)await ac.close().catch(()=>{});
  URL.revokeObjectURL(objectUrl);
 }
}
