import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {safeResearchResponse} from '@/lib/realizo-creative/ai-premium';
import {signedMediaUrl} from '@/lib/realizo-creative/media';
import {buildCommercialDirectorPackage,normalizeProductCopy} from '@/lib/realizo-creative/sales-director';

export const dynamic='force-dynamic';
export async function POST(request,{params}){
 if(!enforceSameOrigin(request))return Response.json({error:'invalid_origin'},{status:403});
 try{
  const env=await getWalletEnvironment();
  const user=await requireWalletUser(request,env);
  if(!user)return Response.json({error:'not_authenticated'},{status:401});
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/i.test(id||''))return Response.json({error:'not_found'},{status:404});
  if(Number(request.headers.get('content-length')||0)>18000)
    return Response.json({error:'payload_too_large'},{status:413});
  const body=await request.json();
  const selection=Number(body.index);
  if(!Number.isInteger(selection)||selection<0||selection>2)
    return Response.json({error:'invalid_concept'},{status:400});
  const db=env.WALLETS_DB;
  let project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
    .bind(id,user.id).first();
  if(!project)return Response.json({error:'not_found'},{status:404});
  if(!['ready','needs_review','approved'].includes(project.status)||!project.concepts_json)
    return Response.json({error:'research_not_ready'},{status:409});
  const concepts=JSON.parse(project.concepts_json);
  const concept=concepts[selection];
  if(!concept || typeof concept.video_prompt!=='string')
    return Response.json({error:'invalid_concept'},{status:400});
  const findings=project.findings_json?JSON.parse(project.findings_json):{};
  const conflicts=Array.isArray(findings.description_conflicts)?findings.description_conflicts:[];
  const claimsToVerify=Array.isArray(findings.claims_to_verify)?findings.claims_to_verify:[];
  const correction=String(body.correction||'').trim().slice(0,700);
  // One concise seller responsibility acknowledgement, not a spelling
  // correction form. Material photo/fact discrepancies remain visible.
  // Facts not established by the research stay visible in the report and
  // are not promoted to verified claims. No extra customer confirmation
  // step is needed to proceed with a truthful creative proposal.
  const userPrompt=String(body.prompt||concept.video_prompt).trim();
  if(userPrompt.length<60||userPrompt.length>5500)
    return Response.json({error:'invalid_prompt'},{status:400});
  const style=['auto','ugc','cinematic','premium','demo'].includes(project.creative_style)
    ?project.creative_style:'auto';
  // Legacy projects with 'auto' may retain the old review-time style selection.
  const finalStyle=style==='auto'&&['auto','ugc','cinematic','premium','demo'].includes(body.style)?body.style:style;
  const userSpeech=String(body.speech??concept.spoken_script??concept.script??'').trim();
  if(userSpeech.length>650 || (finalStyle==='ugc' && userSpeech.length<12))
    return Response.json({error:'invalid_spoken_script'},{status:400});
  const shotPreference=['auto','single','multi'].includes(body.shot_preference)?body.shot_preference:'auto';
  const directorConcept={...concept,video_prompt:userPrompt,spoken_script:userSpeech};
  const modelId=project.video_model_id||'seedance-2.5-omni-reference';
  const duration=Number(project.video_duration_seconds)||8;
  const spokenWords=userSpeech.split(/\s+/).filter(Boolean).length;
  if(finalStyle==='ugc' && (spokenWords<Math.max(5,Math.floor(duration*1.4)) ||
     spokenWords>Math.floor(duration*2.4)))
    return Response.json({error:'ugc_speech_timing_invalid'},{status:422});
  const workflowId=project.video_workflow_id||null;
  const director=buildCommercialDirectorPackage({
    concept:directorConcept,productName:normalizeProductCopy(project.product_name),
    description:normalizeProductCopy(project.description),cta:concept.cta||project.cta,
    market:project.market_code,videoLanguage:project.video_language||'es',style:finalStyle,shotPreference,duration,
    imageProvided:true,modelId,workflowId,
  });
  // Preserve the seller's commercial intent while keeping unverified product
  // statements visibly distinguishable from claims substantiated by sources.
  const finalPrompt=director.prompt.slice(0,5500);
  await db.prepare(
    "UPDATE realizo_ai_projects SET status='approved',selected_concept=?,approved_prompt=?,updated_at=datetime('now') WHERE id=? AND user_id=?"
  ).bind(selection,finalPrompt,id,user.id).run();
  project=await db.prepare('SELECT * FROM realizo_ai_projects WHERE id=? AND user_id=?')
    .bind(id,user.id).first();
  const asset=await db.prepare(
    'SELECT expires_at FROM realizo_media_assets WHERE id=? AND user_id=? AND deleted_at IS NULL'
  ).bind(project.primary_asset_id,user.id).first();
  if(!asset || Number(asset.expires_at)<=Math.floor(Date.now()/1000)+60)
    return Response.json({error:'image_expired_reupload'},{status:409});
  const image=await signedMediaUrl(env,project.primary_asset_id,Math.min(
    Number(asset.expires_at),Math.floor(Date.now()/1000)+3600));
  return Response.json({
    ...safeResearchResponse(project),ready_for_editor:{
      prompt:finalPrompt,images:director.model_capabilities.imageRole==='none'?[]:[image],
      productName:normalizeProductCopy(project.product_name),
      productDescription:normalizeProductCopy(project.description),
      market:project.market_code,video_language:project.video_language||'es',
      video_model_id:modelId,video_duration_seconds:duration,video_workflow_id:workflowId,
      revision:crypto.randomUUID(),project_id:id,approved_concept:selection,
      media_role:director.model_capabilities.imageRole==='product_reference'?'reference_only':
        director.model_capabilities.imageRole==='start_frame'?'start_frame':'none',creative_style:finalStyle,
      shot_preference:shotPreference,creative_concept:directorConcept,
      overlay_cta:director.cta,spoken_script:director.spoken_script,
      product_claims_to_verify:claimsToVerify,
      creative_director_version:director.quality_version,
    },
  },{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return jsonError(e)}
}
