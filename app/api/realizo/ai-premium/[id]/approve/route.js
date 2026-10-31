import {getWalletEnvironment,requireWalletUser,jsonError} from '@/lib/wallet/server';
import {enforceSameOrigin} from '@/lib/wallet/access-auth';
import {safeResearchResponse} from '@/lib/realizo-creative/ai-premium';
import {signedMediaUrl} from '@/lib/realizo-creative/media';

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
  if(claimsToVerify.length && body.acknowledged_claims!==true)
    return Response.json({error:'review_unverified_claims'},{status:422});
  if(conflicts.length && (!body.acknowledged_conflicts||correction.length<10))
    return Response.json({error:'resolve_product_conflict_first'},{status:422});
  const userPrompt=String(body.prompt||concept.video_prompt).trim();
  if(userPrompt.length<60||userPrompt.length>5500)
    return Response.json({error:'invalid_prompt'},{status:400});
  const finalPrompt=[
    'Anuncio de video comercial. Mantener fielmente forma, marca, color y etiqueta visibles en la fotografía principal.',
    'Usa la foto principal como referencia dominante; no rediseñar el envase.',
    'Concepto: '+String(concept.name).slice(0,120)+'.',
    'Dirección creativa: '+userPrompt,
    correction?'Corrección confirmada por el vendedor: '+correction+'.':'',
    claimsToVerify.length?'No afirmar ni representar como comprobados estos datos pendientes de validar: '+claimsToVerify.slice(0,8).join('; ')+'.':'',
    'No inventar promociones, propiedades clínicas, etiquetas, testimonios o beneficios no confirmados.',
    'Evitar texto escrito directamente por el modelo; el CTA se añadirá como superposición.',
  ].filter(Boolean).join(' ');
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
      prompt:finalPrompt,images:[image],productName:project.product_name,
      revision:crypto.randomUUID(),project_id:id,approved_concept:selection,
      overlay_cta:project.cta||concept.cta,
    },
  },{headers:{'Cache-Control':'private,no-store'}});
 }catch(e){return jsonError(e)}
}
