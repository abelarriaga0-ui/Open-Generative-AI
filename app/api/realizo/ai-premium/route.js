import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {premiumVideoOptions} from '@/lib/realizo-creative/video-specs';
import {getCloudflareContext} from '@opennextjs/cloudflare';
import {launchPremiumResearch,reconcileExpiredPremiumLaunch} from '@/lib/realizo-creative/research-lifecycle';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {
  validatePremiumInput,premiumAccess,premiumPublicEnabled,ownedAsset,
  safeResearchResponse,availableAIFunds,verifiedRealOwnerBalance,researchFingerprint,
  PREMIUM_PRICING_VERSION,premiumSandboxPaidOwner
} from '@/lib/realizo-creative/ai-premium';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
const error=(code,status)=>Response.json({error:code},{status,headers});

export async function GET(request){
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  if(env.PAYPAL_MODE!=='live')return error('real_billing_required',503);
  const access=await premiumAccess(env,user);
  // A private, read-only lookup resolves an ambiguous HTTP 503 by the same
  // idempotency key, without opening a second OpenAI request or reservation.
  const key=new URL(request.url).searchParams.get('request_key');
  if(key){
    if(!/^[A-Za-z0-9_-]{12,128}$/.test(key))return error('invalid_request_key',400);
    const existing=await env.WALLETS_DB.prepare(
      'SELECT * FROM realizo_ai_projects WHERE user_id=? AND request_key=?'
    ).bind(user.id,key).first();
    if(!existing)return error('research_request_not_found',404);
    const recovered=await reconcileExpiredPremiumLaunch(env.WALLETS_DB,existing);
    return Response.json(safeResearchResponse(recovered),{headers});
  }
  const list=await env.WALLETS_DB.prepare(
   'SELECT id,status,product_name,market_code,created_at FROM realizo_ai_projects WHERE user_id=? ORDER BY created_at DESC LIMIT 12'
  ).bind(user.id).all();
  const aiFunds=access.mode==='paid'?await availableAIFunds(env,user.id):0;
  return Response.json({
   enabled:access.enabled, ai_configured:Boolean(env.OPENAI_API_KEY),
   billing_mode:access.mode,
   customer_charge_cents:access.price_cents,
   general_available_cents:aiFunds,
   video_charge_separate:true,
   pricing_version:PREMIUM_PRICING_VERSION,
   video_options:premiumVideoOptions(),
   cost_tracking:'provider_usage_estimate; provider invoice reconciliation required',
   research_scope:'Foto y mercado + tres propuestas de venta. Video aparte.',
   projects:list.results??[],
   message:access.enabled?
      (access.mode==='sponsored'
        ?'Investigación de IA gratis por ahora: tres propuestas de venta. El video se cobra por separado.'
        :'Investigación de pago: USD 0.49 por tres conceptos. El video se cobra por separado.'):
      'La investigación de IA no está disponible en este momento.',
  },{headers});
 }catch(e){return jsonError(e)}
}
export async function POST(request){
 if(!enforceSameOrigin(request))return error('invalid_origin',403);
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return error('not_authenticated',401);
  const access=await premiumAccess(env,user);
  if(!access.enabled)return error('ai_premium_not_enabled',503);
  // Return 202 before awaiting OpenAI. The provider's initial request can
  // exceed the HTTP edge window; waitUntil holds work safely after response.
  // Do not reserve a customer's money without a background execution context.
  const ctx=getCloudflareContext().ctx;
  if(typeof ctx?.waitUntil!=='function')
    return error('research_background_unavailable',503);
  if(Number(request.headers.get('content-length')||0)>5000)return error('request_too_large',413);
  const body=await request.json();
  let data;
  try{data=validatePremiumInput(body)}
  catch(e){
   if(e.message==='invalid_ad_template')return error('invalid_ad_template',422);
   if(e.message==='premium_audio_cast_conflict')return error('premium_audio_cast_conflict',422);
   throw e;
  }
  if(body.max_price_cents!==access.price_cents ||
     body.pricing_version!==PREMIUM_PRICING_VERSION) return error('price_changed_confirm_again',409);
  const db=env.WALLETS_DB;
  const existing=await db.prepare(
   'SELECT * FROM realizo_ai_projects WHERE user_id=? AND request_key=?'
  ).bind(user.id,data.requestKey).first();
  if(existing){
    const recovered=await reconcileExpiredPremiumLaunch(db,existing);
    return Response.json(safeResearchResponse(recovered),{headers});
  }
  const asset=await ownedAsset(env,user,data.assetId);
  if(!asset)return error('image_missing_or_expired',422);
  const fp=await researchFingerprint(data);
  const reusable=await db.prepare(
    "SELECT * FROM realizo_ai_projects WHERE user_id=? AND research_fingerprint=? AND status IN ('ready','needs_review','approved') AND concepts_json IS NOT NULL AND created_at>=datetime('now','-2 days') ORDER BY created_at DESC LIMIT 1"
  ).bind(user.id,fp).first();
  if(reusable)return Response.json({...safeResearchResponse(reusable),reused:true},{headers});
  if(access.mode==='paid'){
   // Verified funding is mandatory. Sandbox test money is excluded; only
   // live PayPal deposits or the owner's independently reconciled real funds qualify.
   const sandboxOwner=await premiumSandboxPaidOwner(env,user);
   const reconciledRealOwner=await verifiedRealOwnerBalance(env,user.id);
   if(!premiumPublicEnabled(env) && !sandboxOwner)return error('real_billing_required',503);
   // The provider-verified, historically imported owner account owns real
   // spendable funds even if there was no separate PayPal Live deposit.
   // All other users still require a verified PayPal Live payment.
   if(!reconciledRealOwner){
     const deposits=await db.prepare(
      "SELECT COUNT(*) AS n FROM verified_deposits WHERE user_id=? AND payment_provider='paypal' AND status='paid' AND provider_environment='live'"
     ).bind(user.id).first();
     if(!Number(deposits?.n))return error('verified_real_topup_required',402);
   }
   if(await availableAIFunds(env,user.id)<access.price_cents)
    return error('insufficient_general_funds',402);
  }
  const projectId=crypto.randomUUID(), orderId=crypto.randomUUID();
  const ins=db.prepare(
   'INSERT INTO realizo_ai_projects (id,user_id,primary_asset_id,product_name,description,audience,sales_angle,market_code,cta,request_key,status,research_model,billing_type,premium_price_cents,research_fingerprint,pricing_version,video_language,video_model_id,video_duration_seconds,video_workflow_id,creative_style,template_id,template_actor,template_setting,template_change_request,cast_mode,audio_mode,video_settings_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(projectId,user.id,data.assetId,data.productName,data.description,data.audience,
    data.angle,data.market,data.cta,data.requestKey,'created',env.OPENAI_PREMIUM_MODEL,
    access.mode,access.price_cents,fp,PREMIUM_PRICING_VERSION,data.videoLanguage,
    data.modelId,data.duration,data.workflowId,data.creativeStyle,
    data.templateId,data.templateActor,data.templateSetting,data.templateChangeRequest,data.castMode,data.audioMode,JSON.stringify(data.videoSettings));
  try{
   // D1 batch is transactional: both the project and its premium reservation
   // succeed together, or neither succeeds. Never call OpenAI first.
   if(access.mode==='paid'){
    const reserve=db.prepare(
     'INSERT INTO realizo_ai_premium_orders(id,project_id,user_id,price_cents) VALUES (?,?,?,?)'
    ).bind(orderId,projectId,user.id,access.price_cents);
    await db.batch([ins,reserve]);
   }else await ins.run();
  }catch(e){
   const collided=await db.prepare(
    'SELECT * FROM realizo_ai_projects WHERE user_id=? AND request_key=?'
   ).bind(user.id,data.requestKey).first();
   if(collided){
     const recovered=await reconcileExpiredPremiumLaunch(db,collided);
     return Response.json(safeResearchResponse(recovered),{headers});
   }
   const message=String(e);
   if(message.includes('ai_premium_daily_limit'))return error('ai_premium_daily_limit',429);
   if(message.includes('ai_insufficient_general_funds'))return error('insufficient_general_funds',402);
   return error('ai_premium_reservation_failed',409);
  }
  // Reserve atomically, then dispatch the provider in Cloudflare waitUntil.
  // The front end receives its project ID immediately and polls it safely.
  await db.prepare(
    "UPDATE realizo_ai_projects SET status='researching',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='created'"
  ).bind(projectId,user.id).run();
  const task=launchPremiumResearch(env,{
    projectId,userId:user.id,expiresAt:asset.expires_at,
  });
  ctx.waitUntil(task);
  const project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
   .bind(projectId,user.id).first();
  return Response.json(safeResearchResponse(project),{status:202,headers});
 }catch(e){
  if(['invalid_request','invalid_video_configuration'].includes(e?.message))return error(e.message,400);
  return jsonError(e);
 }
}
