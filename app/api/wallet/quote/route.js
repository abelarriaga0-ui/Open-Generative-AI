import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {isMuapiGenerationEnabled} from '@/lib/wallet/generation-policy';
import {isOwnerMultiModelSandbox} from '@/lib/wallet/multi-model-access';
import {quoteLiveVideo,ensureOwnedMedia,userFacingQuoteError} from '@/lib/wallet/live-video-models';

export const dynamic='force-dynamic';
export async function POST(request) {
  if(!enforceSameOrigin(request))
    return Response.json({error:'invalid_origin'},{status:403});
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    if(!isMuapiGenerationEnabled(env,user) ||
       !await isOwnerMultiModelSandbox(env,user) || !env.MUAPI_API_KEY)
      return Response.json({error:'model_not_ready_for_generation'},{status:503});
    if(Number(request.headers.get('content-length')||0)>125000)
      return Response.json({error:'payload_too_large'},{status:413});
    const body=await request.json();
    await ensureOwnedMedia(env,user,body.input);
    const quote=await quoteLiveVideo(body.model_id,body.input);
    const wallet=await env.WALLETS_DB.prepare(
      'SELECT available_cents FROM wallets WHERE user_id=?'
    ).bind(user.id).first();
    if(!wallet)return Response.json({error:'wallet_not_found'},{status:404});
    return Response.json({
      model_id: quote.model_id,
      price_cents: quote.provider_cost_cents,
      available_cents: wallet.available_cents,
      affordable: wallet.available_cents >= quote.provider_cost_cents,
      currency:'USD',
      note:'Importe calculado de Muapi, sin recargo para el titular del crédito original. Se confirmará antes de gastar.'
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(err) {
    const code=userFacingQuoteError(err);
    if(code!=='quote_unavailable')
      return Response.json({error:code},{status:422});
    return jsonError(err);
  }
}
