import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {
  premiumAccess,premiumSandboxPaidOwner,readOpenAIResearch,parseResearchResult,safeResearchResponse,
} from '@/lib/realizo-creative/ai-premium';

import {estimateOpenAIResearchCost} from '@/lib/realizo-creative/openai-costs';

export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request,{params}){
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return Response.json({error:'not_authenticated'},{status:401});
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id||''))return Response.json({error:'not_found'},{status:404});
  const db=env.WALLETS_DB;
  let project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
    .bind(id,user.id).first();
  if(!project)return Response.json({error:'not_found'},{status:404});
  if(project.status==='researching' && project.provider_response_id &&
     (await premiumAccess(env,user)).enabled){
    const last=new Date(project.updated_at.replace(' ','T')+'Z').getTime();
    // Rate limit server-to-OpenAI polling across many browser tabs.
    if(Number.isFinite(last)&&Date.now()-last>4500){
      await db.prepare("UPDATE realizo_ai_projects SET updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'")
        .bind(id,user.id).run();
      try{
        const response=await readOpenAIResearch(env,project.provider_response_id);
        if(response.status==='completed'){
          const {report,sources}=parseResearchResult(response,{creativeStyle:project.creative_style||'auto',duration:project.video_duration_seconds||8});
          // Mark conflicts as needs_review, but give customer all 3 concepts.
          const status=report.description_conflicts.length?'needs_review':'ready';
          await db.prepare(
            'UPDATE realizo_ai_projects SET status=?,findings_json=?,concepts_json=?,sources_json=?,error_code=NULL,updated_at=datetime("now") WHERE id=? AND user_id=? AND status=?'
          ).bind(status,JSON.stringify({
            product_observation:report.product_observation,
            description_conflicts:report.description_conflicts,
            verified_claims:report.verified_claims,
            claims_to_verify:report.claims_to_verify,
            market_summary:report.market_summary,
            audience_insights:report.audience_insights,
            research_limitations:report.research_limitations,
            recommended_index:report.recommended_index,
          }),JSON.stringify(report.concepts),JSON.stringify(sources),id,user.id,'researching').run();
          const used=(response.output||[]).filter(o=>o.type==='web_search_call').length;
          const input=Number(response.usage?.input_tokens||0),output=Number(response.usage?.output_tokens||0);
          const cached=Number(response.usage?.input_tokens_details?.cached_tokens||0);
          const cost=estimateOpenAIResearchCost({
            model:response.model||project.research_model||env.OPENAI_PREMIUM_MODEL,
            usage:response.usage,webCalls:used,
          });
          await db.prepare(
            'INSERT OR IGNORE INTO realizo_ai_usage (project_id,user_id,model,input_tokens,output_tokens,web_calls,cached_input_tokens,estimated_cost_micro_usd,cost_status,cost_pricing_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?)'
          ).bind(id,user.id,project.research_model||env.OPENAI_PREMIUM_MODEL,
            input,output,used,cached,cost.microUsd,cost.status,cost.pricingSnapshot).run();
          // Capture exactly once only when valid research and 3 concepts have
          // been persisted; Sandbox-sponsored work has no order at all.
          if(project.billing_type==='paid'){
            await db.prepare(
              "UPDATE realizo_ai_premium_orders SET status='captured',updated_at=datetime('now') WHERE project_id=? AND user_id=? AND status='reserved'"
            ).bind(id,user.id).run();
          }
        }else if(['failed','cancelled','incomplete'].includes(response.status)){
          await db.prepare(
            "UPDATE realizo_ai_projects SET status='failed',error_code='research_failed',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'"
          ).bind(id,user.id).run();
          if(project.billing_type==='paid')
            await db.prepare(
              "UPDATE realizo_ai_premium_orders SET status='released',updated_at=datetime('now') WHERE project_id=? AND user_id=? AND status='reserved'"
            ).bind(id,user.id).run();
        }
      }catch(e){
        // A completed but structurally unusable response is a failed
        // deliverable: refund it, even though the provider used tokens.
        // Transient network/database failures stay pending for reconciliation.
        if(e?.message==='research_invalid_content' || e instanceof SyntaxError){
          await db.prepare(
            "UPDATE realizo_ai_projects SET status='failed',error_code='unusable_research',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'"
          ).bind(id,user.id).run();
          if(project.billing_type==='paid')
            await db.prepare(
              "UPDATE realizo_ai_premium_orders SET status='released',updated_at=datetime('now') WHERE project_id=? AND user_id=? AND status='reserved'"
            ).bind(id,user.id).run();
        }
      }
      project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
        .bind(id,user.id).first();
    }
  }
  const response=safeResearchResponse(project);
  // Provider cost is private business accounting, not an exact charge to the customer.
  if(await premiumSandboxPaidOwner(env,user)){
   const audit=await db.prepare(
     'SELECT model,input_tokens,output_tokens,cached_input_tokens,web_calls,estimated_cost_micro_usd,cost_status,cost_pricing_snapshot FROM realizo_ai_usage WHERE project_id=? AND user_id=?'
   ).bind(id,user.id).first();
   if(audit)response.owner_cost_audit={...audit,disclaimer:'Estimación por tarifas publicadas; conciliar contra costos facturados de OpenAI.'};
  }
  return Response.json(response,{headers});
 }catch(e){return jsonError(e)}
}
