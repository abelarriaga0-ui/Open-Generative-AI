import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {isMuapiGenerationEnabled} from '@/lib/wallet/generation-policy';
import {isOwnerMultiModelSandbox} from '@/lib/wallet/multi-model-access';
import {quoteLiveVideo,ensureOwnedMedia,userFacingQuoteError} from '@/lib/wallet/live-video-models';
import {verifyPremiumGeneration} from '@/lib/realizo-creative/premium-generation-gate';
import {applyRealismToVideoInput} from '@/lib/realizo-creative/video-realism';

export const dynamic='force-dynamic';
export async function POST(request) {
  if(!enforceSameOrigin(request))
    return Response.json({error:'invalid_origin'},{status:403});
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    if(!isMuapiGenerationEnabled(env,user) ||
       (env.REALIZO_ENV==='sandbox' && !await isOwnerMultiModelSandbox(env,user)) || !env.MUAPI_API_KEY)
      return Response.json({error:'model_not_ready_for_generation'},{status:503});
    if(Number(request.headers.get('content-length')||0)>125000)
      return Response.json({error:'payload_too_large'},{status:413});
    const body=await request.json();
    const premiumError=await verifyPremiumGeneration(env.WALLETS_DB,user.id,body.model_id,body.input,body.creative_context);
    if(premiumError)return Response.json({error:premiumError},{status:422});
    const renderInput=applyRealismToVideoInput(body.input);
    await ensureOwnedMedia(env,user,renderInput);
    const quote=await quoteLiveVideo(body.model_id,renderInput,env.MUAPI_API_KEY,{requireLivePostRoute:true});
    // Display the full customer amount, including Realizo's 5% service margin.
    const customerPriceCents=Math.max(quote.provider_cost_cents+1,Math.ceil(quote.provider_cost_cents*1.05));
    const wallet=await env.WALLETS_DB.prepare(
      'SELECT available_cents FROM wallets WHERE user_id=?'
    ).bind(user.id).first();
    if(!wallet)return Response.json({error:'wallet_not_found'},{status:404});
    return Response.json({
      model_id: quote.model_id,
      price_cents: customerPriceCents,
      available_cents: wallet.available_cents,
      affordable: wallet.available_cents >= customerPriceCents,
      currency:'USD',
      note:'Precio calculado para esta configuración. Se confirmará antes de reservar créditos.'
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(err) {
    const code=userFacingQuoteError(err);
    if(code!=='quote_unavailable')
      return Response.json({error:code},{status:422});
    return jsonError(err);
  }
}
