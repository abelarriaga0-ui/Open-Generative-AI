import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {reconcilePendingUserImages} from '@/lib/realizo-images/reconcile';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store'};
function getImageUrl(json){
 try{
  const v=JSON.parse(json||'null');
  const output=v?.outputs??v?.output??v?.url;
  if(typeof output==='string'&&output.startsWith('https://'))return output;
  if(Array.isArray(output)&&output.length){
   const first=output[0];
   return typeof first==='string'?first:first?.url||null;
  }
  return output&&typeof output==='object'?(output.url||null):null;
 }catch{return null;}
}
export async function GET(request){
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return Response.json({error:'not_authenticated'},{status:401,headers});
  await reconcilePendingUserImages(env,user.id).catch(()=>{});
  const result=await env.WALLETS_DB.prepare(
   'SELECT c.id,c.image_job_id,c.brief_json,c.created_at,j.status,j.result_json FROM realizo_image_creations c '+
   'JOIN generation_jobs j ON j.id=c.image_job_id AND j.user_id=c.user_id '+
   'WHERE c.user_id=? ORDER BY c.created_at DESC,c.id DESC LIMIT 50'
  ).bind(user.id).all();
  const creations=(result.results||[]).map(item=>{
   let config;try{config=JSON.parse(item.brief_json)}catch{config={};}
   return {id:item.id,job_id:item.image_job_id,created_at:item.created_at,status:item.status,
    config,image_url:item.status==='completed'?getImageUrl(item.result_json):null};
  });
  return Response.json({creations},{headers});
 }catch(e){return jsonError(e);}
}
