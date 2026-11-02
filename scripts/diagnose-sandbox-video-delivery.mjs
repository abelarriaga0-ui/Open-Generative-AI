// Diagnose the last completed Gemini video from Sandbox without printing user data,
// video URLs, credentials, file content or triggering any generation/payment.
import {execFileSync} from 'node:child_process';
const cwd=process.cwd();
const args=['--yes','wrangler@4.156.2','d1','execute','realizo-wallets-sandbox','--remote',
  '--config','wrangler.auth-sandbox.jsonc','--json','--command',
  "SELECT result_json FROM generation_jobs WHERE status='completed' AND model_id='gemini-omni-image-to-video' AND created_at >= '2026-11-02' ORDER BY created_at DESC LIMIT 1;"];
let output;
try{output=execFileSync('npx',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});}
catch(e){console.log('DIAG database unavailable (no secrets exposed)');process.exitCode=1;process.exit();}
let data;
try{data=JSON.parse(output);}catch{console.log('DIAG D1 JSON unavailable');process.exitCode=1;process.exit();}
const result=data?.[0]?.results?.[0]?.result_json||data?.results?.[0]?.result_json;
if(!result){console.log('DIAG no matching completed video');process.exit();}
let v;try{v=JSON.parse(result);}catch{console.log('DIAG malformed saved result');process.exit();}
const video=v.url||v.output_url||v.output?.url||v.outputs?.[0]?.url||v.outputs?.[0];
if(typeof video!=='string'){console.log('DIAG no output URL');process.exit();}
let u;try{u=new URL(video);}catch{console.log('DIAG invalid output URL');process.exit();}
console.log('DIAG host:',u.hostname,'path form:',u.pathname.startsWith('/outputs/'), 'query:',!!u.search);
for(const [label,options] of [
  ['head', {method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(12000)}],
  ['range',{method:'GET',headers:{Range:'bytes=0-1023',Accept:'video/mp4,*/*'},redirect:'follow',signal:AbortSignal.timeout(15000)}]
]){
 try{
   const r=await fetch(video,options);
   console.log('DIAG '+label+' HTTP '+r.status+' mime '+(r.headers.get('content-type')||'unknown').split(';')[0]+' length '+(r.headers.get('content-length')||'?')+' redirectHost '+new URL(r.url).hostname);
   await r.body?.cancel?.();
 }catch(e){console.log('DIAG '+label+' network_failure '+(e?.name||'Error'));}
}
