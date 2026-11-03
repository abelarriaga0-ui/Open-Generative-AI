import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {SAFE_ID} from '@/lib/realizo-images/creative';
export const dynamic='force-dynamic';
export async function DELETE(request,{params}){
 if(!enforceSameOrigin(request))return Response.json({error:'invalid_origin'},{status:403});
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return Response.json({error:'not_authenticated'},{status:401});
  const {id}=await params;
  if(!SAFE_ID.test(id||''))return Response.json({error:'preset_not_found'},{status:404});
  const out=await env.WALLETS_DB.prepare('DELETE FROM realizo_image_presets WHERE id=? AND user_id=?')
   .bind(id,user.id).run();
  if(out.meta?.changes!==1)return Response.json({error:'preset_not_found'},{status:404});
  return Response.json({deleted:true},{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return jsonError(e);}
}
