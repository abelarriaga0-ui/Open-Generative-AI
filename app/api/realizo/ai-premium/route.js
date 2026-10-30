import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {
  validatePremiumInput,premiumBetaOwner,premiumBetaEnabled,ownedAsset,
  startOpenAIResearch,safeResearchResponse,
} from '@/lib/realizo-creative/ai-premium';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request){
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    const access=await premiumBetaOwner(env,user);
    const list=await env.WALLETS_DB.prepare(
      'SELECT id,status,product_name,market_code,created_at FROM realizo_ai_projects WHERE user_id=? ORDER BY created_at DESC LIMIT 12'
    ).bind(user.id).all();
    return Response.json({
      enabled:access,ai_configured:premiumBetaEnabled(env),
      billing_mode:'sandbox_owner_beta_no_customer_charge',
      customer_charge_cents:0,video_charge_separate:true,
      projects:list.results??[],
      message:access?'Beta privada: la investigación usa presupuesto del negocio, no tu saldo Muapi.':
        'Realizo AI Premium está preparado, pendiente de activar la API de OpenAI para la beta.',
    },{headers});
  }catch(e){return jsonError(e)}
}
export async function POST(request){
  if(!enforceSameOrigin(request))return Response.json({error:'invalid_origin'},{status:403});
  try{
    const env=await getWalletEnvironment();
    const user=await requireWalletUser(request,env);
    if(!user)return Response.json({error:'not_authenticated'},{status:401});
    if(!await premiumBetaOwner(env,user))
      return Response.json({error:'ai_premium_not_enabled'},{status:503});
    if(Number(request.headers.get('content-length')||0)>5000)
      return Response.json({error:'request_too_large'},{status:413});
    const data=validatePremiumInput(await request.json());
    const asset=await ownedAsset(env,user,data.assetId);
    if(!asset)return Response.json({error:'image_missing_or_expired'},{status:422});
    const db=env.WALLETS_DB;
    const existing=await db.prepare(
      'SELECT * FROM realizo_ai_projects WHERE user_id=? AND request_key=?'
    ).bind(user.id,data.requestKey).first();
    if(existing)return Response.json(safeResearchResponse(existing),{headers});
    // Beta only: maximum one new research project / UTC day / account.
    // A future paid rollout requires a separate funded AI ledger.
    const count=await db.prepare(
      "SELECT COUNT(*) AS n FROM realizo_ai_projects WHERE user_id=? AND created_at>=datetime('now','-1 day')"
    ).bind(user.id).first();
    if(Number(count?.n||0)>=1)
      return Response.json({error:'ai_premium_daily_limit'},{status:429});
    const projectId=crypto.randomUUID();
    await db.prepare(
      'INSERT OR IGNORE INTO realizo_ai_projects (id,user_id,primary_asset_id,product_name,description,audience,sales_angle,market_code,cta,request_key,status,research_model) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(projectId,user.id,data.assetId,data.productName,data.description,data.audience,
      data.angle,data.market,data.cta,data.requestKey,'created',env.OPENAI_PREMIUM_MODEL).run();
    let project=await db.prepare(
      'SELECT * FROM realizo_ai_projects WHERE user_id=? AND request_key=?'
    ).bind(user.id,data.requestKey).first();
    if(!project)return Response.json({error:'ai_premium_creation_failed'},{status:500});
    if(project.id!==projectId)
      return Response.json(safeResearchResponse(project),{headers});
    // Claim BEFORE hitting a paid external API. If upstream state is ambiguous,
    // preserve "researching" instead of launching a second paid request.
    await db.prepare("UPDATE realizo_ai_projects SET status='researching',updated_at=datetime('now') WHERE id=? AND status='created'")
      .bind(projectId).run();
    try{
      const launched=await startOpenAIResearch(env,{...project,expires_at:asset.expires_at});
      await db.prepare(
        'UPDATE realizo_ai_projects SET provider_response_id=?,updated_at=datetime("now") WHERE id=? AND user_id=? AND status=?'
      ).bind(launched.id,projectId,user.id,'researching').run();
    }catch(err){
      // An ambiguous network failure may have consumed provider tokens.
      // Do NOT resubmit automatically on the same request key.
      await db.prepare(
        "UPDATE realizo_ai_projects SET status='needs_review',error_code='research_launch_unconfirmed',updated_at=datetime('now') WHERE id=? AND user_id=?"
      ).bind(projectId,user.id).run();
    }
    project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
      .bind(projectId,user.id).first();
    return Response.json(safeResearchResponse(project),{status:202,headers});
  }catch(e){
    if(e.message==='invalid_request')return Response.json({error:'invalid_request'},{status:400});
    return jsonError(e);
  }
}
