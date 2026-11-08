import {getCloudflareContext} from '@opennextjs/cloudflare';
import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {premiumPolishNeed,polishPremiumSpeechWithAI} from '@/lib/realizo-creative/premium-speech-polish';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store'};
const error=(code,status)=>Response.json({error:code},{status,headers});
async function ownedProject(request,env,id){
 const user=await requireWalletUser(request,env);
 if(!user)return null;
 const project=await env.WALLETS_DB.prepare(
  'SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=? LIMIT 1'
 ).bind(id,user.id).first();
 return project?{user,project}:null;
}
const isId=id=>/^[a-f0-9-]{36}$/i.test(id||'');
const indexFrom=request=>Number(new URL(request.url).searchParams.get('index'));
function getConcept(project,index){
 if(!['ready','needs_review','approved'].includes(project.status))return null;
 const concepts=JSON.parse(project.concepts_json||'[]');
 return concepts[index]||null;
}
async function state(db,id,index){
 // Do not retry an uncertain chargeable OpenAI request: a timed-out internal
 // polish is a Realizo service expense, never a customer fee.
 await db.prepare(
  "UPDATE realizo_ai_premium_speech_polish SET status='failed',updated_at=datetime('now') WHERE project_id=? AND concept_index=? AND status='processing' AND updated_at<datetime('now','-3 minutes')"
 ).bind(id,index).run();
 return db.prepare(
  'SELECT status,spoken_script FROM realizo_ai_premium_speech_polish WHERE project_id=? AND concept_index=?'
 ).bind(id,index).first();
}
export async function GET(request,{params}){
 try{
  const {id}=await params;
  if(!isId(id))return error('not_found',404);
  const env=await getWalletEnvironment();
  const found=await ownedProject(request,env,id);
  if(!found)return error('not_found',404);
  const index=indexFrom(request);
  if(!Number.isInteger(index)||index<0||index>2)return error('invalid_concept',400);
  const concept=getConcept(found.project,index);
  if(!concept)return error('research_not_ready',409);
  const need=premiumPolishNeed(found.project,concept);
  if(!need)return Response.json({status:'not_needed'},{headers});
  const result=await state(env.WALLETS_DB,id,index);
  return Response.json({status:result?.status||'not_started',
   spoken_script:result?.status==='completed'?result.spoken_script:undefined},{headers});
 }catch{return error('premium_polish_status_unavailable',503)}
}
export async function POST(request,{params}){
 if(!enforceSameOrigin(request))return error('invalid_origin',403);
 try{
  if(Number(request.headers.get('content-length')||0)>350)return error('payload_too_large',413);
  const {id}=await params;
  if(!isId(id))return error('not_found',404);
  const env=await getWalletEnvironment();
  const found=await ownedProject(request,env,id);
  if(!found)return error('not_found',404);
  const body=await request.json().catch(()=>({}));
  const index=Number(body.index);
  if(!Number.isInteger(index)||index<0||index>2)return error('invalid_concept',400);
  const {project}=found;
  const concept=getConcept(project,index);
  if(!concept)return error('research_not_ready',409);
  const need=premiumPolishNeed(project,concept);
  if(!need)return Response.json({status:'not_needed',spoken_script:concept.spoken_script||concept.script},{headers});
  const db=env.WALLETS_DB;
  const existing=await state(db,id,index);
  if(existing)return Response.json({
   status:existing.status,spoken_script:existing.status==='completed'?existing.spoken_script:undefined
  },{headers});
  const ctx=getCloudflareContext().ctx;
  if(typeof ctx?.waitUntil!=='function')return error('premium_polish_background_unavailable',503);
  const inserted=await db.prepare(
    "INSERT OR IGNORE INTO realizo_ai_premium_speech_polish(project_id,concept_index,status) VALUES (?,?,'processing')"
  ).bind(id,index).run();
  if(Number(inserted.meta?.changes||0)===1){
   const task=(async()=>{
    try{
     const speech=await polishPremiumSpeechWithAI(env,project,concept);
     await db.prepare(
      "UPDATE realizo_ai_premium_speech_polish SET status='completed',spoken_script=?,updated_at=datetime('now') WHERE project_id=? AND concept_index=? AND status='processing'"
     ).bind(speech,id,index).run();
    }catch{
     // No raw OpenAI error or personal prompt is ever logged or returned.
     await db.prepare(
      "UPDATE realizo_ai_premium_speech_polish SET status='failed',updated_at=datetime('now') WHERE project_id=? AND concept_index=? AND status='processing'"
     ).bind(id,index).run().catch(()=>{});
    }
   })();
   ctx.waitUntil(task);
  }
  return Response.json({status:'processing'},{status:202,headers});
 }catch(e){return jsonError(e)}
}
