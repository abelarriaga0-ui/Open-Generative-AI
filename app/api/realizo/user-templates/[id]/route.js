import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers={'Cache-Control':'private,no-store'};
const error=(code,status)=>Response.json({error:code},{status,headers});

export async function GET(request,{params}){
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return error('not_authenticated',401);
    const {id}=await params;
    if(!UUID.test(id))return error('template_not_found',404);
    const record=await env.WALLETS_DB.prepare(
      'SELECT id,title,category,description,model_id,prompt,duration_seconds,workflow_id,created_at FROM realizo_user_templates WHERE id=? AND user_id=?'
    ).bind(id,user.id).first();
    if(!record)return error('template_not_found',404);
    return Response.json({template:record},{headers});
  }catch(e){return jsonError(e);}
}
export async function DELETE(request,{params}){
  if(!enforceSameOrigin(request))return error('invalid_origin',403);
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return error('not_authenticated',401);
    const {id}=await params;
    if(!UUID.test(id))return error('template_not_found',404);
    const result=await env.WALLETS_DB.prepare(
      'DELETE FROM realizo_user_templates WHERE id=? AND user_id=?'
    ).bind(id,user.id).run();
    if(result.meta?.changes!==1)return error('template_not_found',404);
    return Response.json({deleted:true},{headers});
  }catch(e){return jsonError(e);}
}
