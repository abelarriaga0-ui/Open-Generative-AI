import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {presetFromBrief} from '@/lib/realizo-images/creative';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private,no-store'};
const error=(code,status=422)=>Response.json({error:code},{status,headers});
export async function GET(request){
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  const data=await env.WALLETS_DB.prepare(
   'SELECT id,title,config_json,created_at FROM realizo_image_presets WHERE user_id=? ORDER BY created_at DESC LIMIT 60'
  ).bind(user.id).all();
  const presets=(data.results||[]).flatMap(row=>{
   try{return [{id:row.id,title:row.title,config:JSON.parse(row.config_json),created_at:row.created_at}];}
   catch{return [];}
  });
  return Response.json({presets},{headers});
 }catch(e){return jsonError(e);}
}
export async function POST(request){
 if(!enforceSameOrigin(request))return error('invalid_origin',403);
 try{
  if(Number(request.headers.get('content-length')||0)>6000)return error('request_too_large',413);
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  const body=await request.json();
  if(typeof body?.title!=='string'||body.title.trim().length<2||body.title.length>90)return error('invalid_preset_name');
  let config;try{config=presetFromBrief(body.config)}catch(e){return error(e.message);}
  const total=await env.WALLETS_DB.prepare('SELECT COUNT(*) AS n FROM realizo_image_presets WHERE user_id=?').bind(user.id).first();
  if(Number(total?.n||0)>=60)return error('preset_limit_reached',409);
  const title=body.title.replace(/[\r\n\t<>]/g,' ').trim().slice(0,70);
  const id=crypto.randomUUID();
  await env.WALLETS_DB.prepare('INSERT INTO realizo_image_presets(id,user_id,title,config_json) VALUES(?,?,?,?)')
   .bind(id,user.id,title,JSON.stringify(config)).run();
  return Response.json({preset:{id,title,config}},{status:201,headers});
 }catch(e){return jsonError(e);}
}
