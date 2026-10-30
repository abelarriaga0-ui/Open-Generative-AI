import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {
  premiumBetaOwner,readOpenAIResearch,parseResearchResult,safeResearchResponse,
} from '@/lib/realizo-creative/ai-premium';

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
     await premiumBetaOwner(env,user)){
    const last=new Date(project.updated_at.replace(' ','T')+'Z').getTime();
    // Rate limit server-to-OpenAI polling across many browser tabs.
    if(Number.isFinite(last)&&Date.now()-last>4500){
      await db.prepare("UPDATE realizo_ai_projects SET updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'")
        .bind(id,user.id).run();
      try{
        const response=await readOpenAIResearch(env,project.provider_response_id);
        if(response.status==='completed'){
          const {report,sources}=parseResearchResult(response);
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
          await db.prepare(
            'INSERT OR IGNORE INTO realizo_ai_usage (project_id,user_id,model,input_tokens,output_tokens,web_calls) VALUES (?,?,?,?,?,?)'
          ).bind(id,user.id,project.research_model||env.OPENAI_PREMIUM_MODEL,
            Number(response.usage?.input_tokens||0),
            Number(response.usage?.output_tokens||0),
            (response.output||[]).filter(o=>o.type==='web_search_call').length
          ).run();
        }else if(['failed','cancelled','incomplete'].includes(response.status)){
          await db.prepare(
            "UPDATE realizo_ai_projects SET status='failed',error_code='research_failed',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching'"
          ).bind(id,user.id).run();
        }
      }catch{
        // Keep an ambiguous provider response for manual reconciliation.
        // Never charge or resend automatically.
      }
      project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
        .bind(id,user.id).first();
    }
  }
  return Response.json(safeResearchResponse(project),{headers});
 }catch(e){return jsonError(e)}
}
