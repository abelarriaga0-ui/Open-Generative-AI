// The paid research approval is the immutable creative authority for a Premium
// video. Never trust a UI-only cast switch when reserving wallet credits.
export async function verifyPremiumGeneration(db,userId,modelId,input,context){
 if(context==null)return null; // Ordinary video editors do not have a Premium project.
 if(!context || typeof context!=='object'||Array.isArray(context)||
    typeof context.project_id!=='string'||
    !/^[a-f0-9-]{36}$/i.test(context.project_id))
   return 'premium_brief_reapproval_required';
 const project=await db.prepare(
   'SELECT id,status,creative_style,cast_mode,approved_prompt,video_model_id,video_duration_seconds FROM realizo_ai_projects WHERE id=? AND user_id=?'
 ).bind(context.project_id,userId).first();
 if(!project||project.status!=='approved')
   return 'premium_brief_reapproval_required';
 const style=project.creative_style;
 if(style!=='premium'&&style!=='cinematic')return null;
 if(context.creative_style!==style||context.cast_mode!==project.cast_mode||
    modelId!==project.video_model_id||
    Number(input?.duration||0)!==Number(project.video_duration_seconds||0))
   return 'premium_brief_reapproval_required';
 const prompt=typeof input?.prompt==='string'?input.prompt.trim():'';
 if(!prompt||prompt!==String(project.approved_prompt||'').trim())
   return 'premium_brief_reapproval_required';
 if(!prompt.startsWith('REALIZO LUXURY FILM CONTRACT v2')||
    !prompt.includes('PROFESSIONAL CINEMA COMMERCIAL, NOT UGC'))
   return 'premium_brief_reapproval_required';
 if(project.cast_mode==='product_only'&&
    (!prompt.includes('ABSOLUTE PRODUCT-ONLY CAST LOCK')||
     !prompt.includes('ZERO HUMAN PIXELS')))
   return 'premium_cast_contract_missing';
 return null;
}
