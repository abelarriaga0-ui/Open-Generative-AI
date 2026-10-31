import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {
  validatePremiumInput,premiumAccess,premiumPublicEnabled,ownedAsset,
  startOpenAIResearch,safeResearchResponse,availableAIFunds,researchFingerprint,
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
  const access=await premiumAccess(env,user);
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
   research_scope:'Foto y mercado + tres propuestas de venta. Video aparte.',
   projects:list.results??[],
   message:access.enabled?
      'Investigación de pago: USD 0.49 por tres conceptos. Se reserva antes y se cobra si la investigación se completa correctamente. Video aparte.':
      'La investigación requiere saldo real verificado; PayPal Sandbox no crea fondos reales.',
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
  if(Number(request.headers.get('content-length')||0)>5000)return error('request_too_large',413);
  const body=await request.json();
  const data=validatePremiumInput(body);
  if(body.max_price_cents!==access.price_cents ||
     body.pricing_version!==PREMIUM_PRICING_VERSION) return error('price_changed_confirm_again',409);
  const db=env.WALLETS_DB;
  const existing=await db.prepare(
   'SELECT * FROM realizo_ai_projects WHERE user_id=? AND request_key=?'
  ).bind(user.id,data.requestKey).first();
  if(existing)return Response.json(safeResearchResponse(existing),{headers});
  const asset=await ownedAsset(env,user,data.assetId);
  if(!asset)return error('image_missing_or_expired',422);
  const fp=await researchFingerprint(data);
  const reusable=await db.prepare(
    "SELECT * FROM realizo_ai_projects WHERE user_id=? AND research_fingerprint=? AND status IN ('ready','needs_review','approved') AND concepts_json IS NOT NULL AND created_at>=datetime('now','-2 days') ORDER BY created_at DESC LIMIT 1"
  ).bind(user.id,fp).first();
  if(reusable)return Response.json({...safeResearchResponse(reusable),reused:true},{headers});
  if(access.mode==='paid'){
   // Server-verified real payment is mandatory. Fake PayPal Sandbox money,
   // partner provider balances or self-reported topups cannot pay for OpenAI.
   const sandboxOwner=await premiumSandboxPaidOwner(env,user);
   if(!premiumPublicEnabled(env) && !sandboxOwner)return error('real_billing_required',503);
   if(!sandboxOwner){
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
   'INSERT INTO realizo_ai_projects (id,user_id,primary_asset_id,product_name,description,audience,sales_angle,market_code,cta,request_key,status,research_model,billing_type,premium_price_cents,research_fingerprint,pricing_version,video_language) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(projectId,user.id,data.assetId,data.productName,data.description,data.audience,
    data.angle,data.market,data.cta,data.requestKey,'created',env.OPENAI_PREMIUM_MODEL,
    access.mode,access.price_cents,fp,PREMIUM_PRICING_VERSION,data.videoLanguage);
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
   if(collided)return Response.json(safeResearchResponse(collided),{headers});
   const message=String(e);
   if(message.includes('ai_premium_daily_limit'))return error('ai_premium_daily_limit',429);
   if(message.includes('ai_insufficient_general_funds'))return error('insufficient_general_funds',402);
   return error('ai_premium_reservation_failed',409);
  }
  // Mark intent before the paid provider call; ambiguous network errors never
  // trigger a second attempt. Order remains RESERVED for reconciliation.
  await db.prepare(
    "UPDATE realizo_ai_projects SET status='researching',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='created'"
  ).bind(projectId,user.id).run();
  try{
   const project=await db.prepare(
     'SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?'
   ).bind(projectId,user.id).first();
   const launched=await startOpenAIResearch(env,{...project,expires_at:asset.expires_at});
   await db.prepare(
     "UPDATE realizo_ai_projects SET provider_response_id=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'"
   ).bind(launched.id,projectId,user.id).run();
  }catch(e){
   const definitelyRejected=e?.message==='openai_start_rejected';
   // 4xx/5xx provider rejection did not return a valid job: release paid
   // reservation; an ambiguous network failure needs manual reconciliation.
   await db.prepare(
     "UPDATE realizo_ai_projects SET status=?,error_code=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'"
   ).bind(definitelyRejected?'failed':'needs_review',
     definitelyRejected?'openai_rejected':'research_launch_unconfirmed',projectId,user.id).run();
   if(definitelyRejected && access.mode==='paid')
    await db.prepare(
     "UPDATE realizo_ai_premium_orders SET status='released',updated_at=datetime('now') WHERE project_id=? AND user_id=? AND status='reserved'"
    ).bind(projectId,user.id).run();
  }
  const project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
   .bind(projectId,user.id).first();
  return Response.json(safeResearchResponse(project),{status:202,headers});
 }catch(e){
  if(e?.message==='invalid_request')return error('invalid_request',400);
  return jsonError(e);
 }
}
