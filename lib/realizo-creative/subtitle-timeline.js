// Browser-only REALIZO caption timeline. No paid API, no new wallet charge.
// A known script is NOT word-level speech recognition: activity windows guide
// approximation, while the user can correct any differences before export.
const trim=s=>String(s||'').replace(/\s+/g,' ').trim();
export function scriptFromPrompt(prompt){
 const text=String(prompt||'');
 const m=text.match(/SPOKEN SCRIPT\s*\([^)]*\)\s*:\s*["“]([^"”]{1,1500})["”]/i);
 return m?trim(m[1]):'';
}
export function subtitleChunks(script,{maxWords=4}={}){
 const words=trim(script).split(/\s+/u).filter(Boolean).slice(0,600);
 const chunks=[];let current=[];
 for(const word of words){
  current.push(word);
  if(current.length>=maxWords || /[.!?;:]$/.test(word)){
   chunks.push(current.join(' '));current=[];
  }
 }
 if(current.length)chunks.push(current.join(' '));
 return chunks;
}
export function normalizeSpeechRanges(ranges,duration){
 const end=Number(duration);
 if(!Number.isFinite(end)||end<=0)return [];
 return (Array.isArray(ranges)?ranges:[]).map(x=>({
  start:Math.max(0,Math.min(end,Number(x?.start)||0)),
  end:Math.max(0,Math.min(end,Number(x?.end)||0))
 })).filter(x=>x.end>x.start+0.04).sort((a,b)=>a.start-b.start);
}
export function createSubtitleTimeline(script,duration,{speechRanges=[],maxWords=4,offset=0}={}){
 const chunks=subtitleChunks(script,{maxWords});
 const seconds=Number(duration);
 if(!chunks.length||!Number.isFinite(seconds)||seconds<0.5)return [];
 const boundedOffset=Math.max(-2,Math.min(2,Number(offset)||0));
 const ranges=normalizeSpeechRanges(speechRanges,seconds);
 // No reliable energy data => spread script across available playback time.
 const intervals=ranges.length?ranges:[{start:0.1,end:Math.max(0.4,seconds-0.12)}];
 const total=intervals.reduce((n,x)=>n+x.end-x.start,0);
 if(total<=0)return [];
 const weights=chunks.map(s=>Math.max(2,s.replace(/\s/g,'').length));
 const weightSum=weights.reduce((n,x)=>n+x,0);
 const mapPosition=t=>{
  let remaining=Math.max(0,Math.min(total,t));
  for(const interval of intervals){
   const span=interval.end-interval.start;
   if(remaining<=span)return interval.start+remaining;
   remaining-=span;
  }
  return intervals[intervals.length-1].end;
 };
 let cursor=0;
 return chunks.map((s,i)=>{
  const start=mapPosition(cursor/weightSum*total);
  cursor+=weights[i];
  const end=mapPosition(cursor/weightSum*total);
  return {text:s,start:Math.max(0,Math.min(seconds,start+boundedOffset)),
   end:Math.max(0,Math.min(seconds,end+boundedOffset))};
 }).filter(x=>x.end>x.start);
}
// Short-time speech activity estimate from decoded audio. Music/noise can be
// mistaken for speech: this is NOT an ASR/forced alignment service.
export function detectAudioActivity(audioBuffer,{stepMs=40,threshold=0.14}={}){
 const sampleRate=audioBuffer?.sampleRate;
 if(!Number.isFinite(sampleRate)||!audioBuffer.length)return [];
 const frames=Math.max(1,Math.round(sampleRate*stepMs/1000));
 const left=audioBuffer.getChannelData(0);
 const right=audioBuffer.numberOfChannels>1?audioBuffer.getChannelData(1):null;
 const levels=[];
 for(let start=0;start<left.length;start+=frames){
  let sum=0,count=0;
  for(let j=start;j<Math.min(start+frames,left.length);j+=3){
   const amp=right?(left[j]+right[j])*0.5:left[j];
   sum+=amp*amp;count++;
  }
  levels.push(Math.sqrt(sum/Math.max(1,count)));
 }
 const sorted=[...levels].sort((a,b)=>a-b);
 const peak=sorted[Math.floor(sorted.length*0.95)]||0;
 if(peak<0.001)return [];
 const gate=Math.max(0.006,peak*threshold);
 let start=null;const ranges=[];
 const step=frames/sampleRate;
 for(let i=0;i<levels.length;i++){
  if(levels[i]>=gate && start===null)start=i*step;
  if((levels[i]<gate || i===levels.length-1)&&start!==null){
   const end=(i+1)*step;
   if(end-start>=0.15)ranges.push({start,end});
   start=null;
  }
 }
 // Group natural syllabic pauses shorter than 250ms, not long silences.
 const merged=[];
 for(const x of ranges){
  const last=merged[merged.length-1];
  if(last&&x.start-last.end<0.25)last.end=x.end;
  else merged.push({...x});
 }
 return merged;
}
