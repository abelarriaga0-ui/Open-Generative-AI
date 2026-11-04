// Safe durable-state handling for AI Premium research launches.
// The original request returns immediately after the atomic wallet reserve;
// the OpenAI HTTP request continues within Cloudflare ctx.waitUntil. Never
// retry an ambiguous provider POST and never charge for a missing deliverable.
import {startOpenAIResearch} from './ai-premium.js';

const SAFE_STALE_SECONDS=90;

export async function launchPremiumResearch(env,{userId,projectId,expiresAt},startResearch=startOpenAIResearch){
  const db=env.WALLETS_DB;
  try{
    const project=await db.prepare(
      'SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?'
    ).bind(projectId,userId).first();
    if(!project || project.status!=='researching' || project.provider_response_id)return;
    const started=await startResearch(env,{...project,expires_at:expiresAt});
    if(typeof started?.id!=='string'||!started.id.startsWith('resp_'))
      throw Error('openai_invalid_response');
    // The provider response ID is the durable proof for subsequent polling.
    await db.prepare(
      "UPDATE realizo_ai_projects SET provider_response_id=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching' AND provider_response_id IS NULL"
    ).bind(started.id,projectId,userId).run();
  }catch(e){
    const definite=String(e?.message||'').startsWith('openai_start_rejected_');
    const code=definite?
      String(e.message).replace('openai_start_rejected_','openai_rejected_'):
      'research_launch_unconfirmed';
    // If a network failed after the provider might have accepted the work,
    // flag review rather than sending a duplicate billable request.
    try{
      await db.prepare(
        "UPDATE realizo_ai_projects SET status=?,error_code=?,updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching' AND provider_response_id IS NULL"
      ).bind(definite?'failed':'needs_review',code,projectId,userId).run();
      if(definite){
        await db.prepare(
          "UPDATE realizo_ai_premium_orders SET status='released',updated_at=datetime('now') WHERE project_id=? AND user_id=? AND status='reserved'"
        ).bind(projectId,userId).run();
      }
    }catch{
      console.warn('Premium background state write unavailable; stale-launch reconciliation is available');
    }
  }
}

export async function reconcileExpiredPremiumLaunch(db,project,{now=Date.now(),staleSeconds=SAFE_STALE_SECONDS}={}){
  if(!project||project.status!=='researching'||project.provider_response_id)return project;
  const updated=Date.parse(String(project.updated_at||'').replace(' ','T')+'Z');
  if(!Number.isFinite(updated)||now-updated<staleSeconds*1000)return project;
  // A crashed/aborted Worker request may leave a reservation and no response
  // ID. After >90s no background worker can still be starting the provider.
  // Customer receives full refund: the provider's unknown cost is borne by
  // Realizo, never by a customer who received no deliverable.
  await db.batch([
    db.prepare(
      "UPDATE realizo_ai_projects SET status='failed',error_code='research_launch_unconfirmed',updated_at=datetime('now') WHERE id=? AND user_id=? AND status='researching' AND provider_response_id IS NULL AND updated_at<=datetime('now','-90 seconds')"
    ).bind(project.id,project.user_id),
    db.prepare(
      "UPDATE realizo_ai_premium_orders SET status='released',updated_at=datetime('now') WHERE project_id=? AND user_id=? AND status='reserved' AND EXISTS (SELECT 1 FROM realizo_ai_projects WHERE id=? AND user_id=? AND status='failed' AND error_code='research_launch_unconfirmed')"
    ).bind(project.id,project.user_id,project.id,project.user_id),
  ]);
  return await db.prepare(
    'SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?'
  ).bind(project.id,project.user_id).first()||project;
}
