import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
export const dynamic='force-dynamic';
// Server-scoped history: never accept a user_id query parameter.
export async function GET(request) {
  try{
    const env=await getWalletEnvironment();
    if(env.REALIZO_AUTH_PROVIDER!=='native')return Response.json({error:'not_available'},{status:404});
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    const rows=await env.WALLETS_DB.prepare(
      'SELECT id,model_id,status,price_cents,result_json,created_at,updated_at FROM generation_jobs WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 30'
    ).bind(user.id).all();
    const jobs=(rows.results||[]).map(x=>{
      let result=null;
      if(x.status==='completed'&&x.result_json){
        try{
          const json=JSON.parse(x.result_json);
          const raw=json.url||json.output_url||json.output?.url||json.outputs?.[0]?.url||json.outputs?.[0];
          result=typeof raw==='string'&&/^https:\/\//.test(raw)?raw:null;
        }catch{}
      }
      return {id:x.id,model:x.model_id,status:x.status,price_cents:x.price_cents,
        created_at:x.created_at,updated_at:x.updated_at,video_url:result};
    });
    return Response.json({jobs},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return jsonError(e)}
}
