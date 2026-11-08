// Temporary read-only diagnostic for a 30-second AI Premium approval.
// Never logs product names, prompts, provider response IDs, customer IDs,
// media URLs or token secrets. Does not create jobs, charge credits or call AI.
import {HyperrealD1,sqlValue} from './hyperreal-pro-db.mjs';
import {buildCommercialDirectorPackage,normalizeProductCopy} from '../lib/realizo-creative/sales-director.js';
import {selectedStyle} from '../lib/realizo-creative/format-guides.js';
import {normalizeCastMode,isFilmStyle} from '../lib/realizo-creative/cast-mode.js';
import {normalizeAudioMode,filmAudioValid} from '../lib/realizo-creative/audio-mode.js';
import {getAdTemplate} from '../lib/realizo-creative/ad-templates.js';
import {salesAngleDirective} from '../lib/realizo-creative/sales-angle.js';
import {scriptReadiness,improveSalesScript,speechWords} from '../lib/realizo-creative/sales-storyboard.js';
import {premiumVideoOptions} from '../lib/realizo-creative/video-specs.js';

const db=new HyperrealD1(process.env.CLOUDFLARE_API_TOKEN);
const rows=await db.query("SELECT * FROM realizo_ai_projects WHERE video_model_id LIKE 'kling-4.0-%' AND status IN ('ready','needs_review','approved') ORDER BY created_at DESC LIMIT 4");
console.log('PREMIUM_DIAGNOSTIC_PROJECT_COUNT='+rows.length);
for(const p of rows){
 for(const conceptIndex of [0,1,2]){
 let phase='loading',outcome='ok';
 let speechCount=0,minimum=0,maximum=0;
 let existingAsset=false,aliveAsset=false,modelAvailable=false;
 let finalStyle='',audioMode='',castMode='',checks='';
 try{
  phase='metadata';
  const concepts=JSON.parse(p.concepts_json||'[]');
  const c=concepts[conceptIndex];
  if(!c)throw Error('concept_unavailable');
  const research=p.findings_json?JSON.parse(p.findings_json):{};
  const initial=['auto','ugc','cinematic','premium','demo'].includes(p.creative_style)?p.creative_style:'auto';
  const template=getAdTemplate(p.template_id);
  finalStyle=template?.style||selectedStyle(initial,c.creative_style);
  castMode=isFilmStyle(finalStyle)?normalizeCastMode(p.cast_mode):'with_people';
  audioMode=isFilmStyle(finalStyle)?normalizeAudioMode(p.audio_mode):'no_voice';
  if(isFilmStyle(finalStyle)&&!filmAudioValid(audioMode,castMode))throw Error('premium_audio_cast_conflict');
  phase='settings';
  const settings=p.video_settings_json?JSON.parse(p.video_settings_json):{};
  const model=String(p.video_model_id||'');
  const options=premiumVideoOptions();
  const option=options.find(o=>o.id===model);
  modelAvailable=Boolean(option||settings.model_contract?.id===model);
  const workflow=String(p.video_workflow_id||option?.workflow_id||'');
  const seconds=Number(p.video_duration_seconds||8);
  phase='script_quality';
  const spokenStyle=selectedStyle(finalStyle,c.creative_style);
  const dialogue=String(c.spoken_script||c.script||'').trim();
  speechCount=speechWords(dialogue);
  const timing=scriptReadiness(dialogue,{seconds,style:spokenStyle,description:p.description||''});
  minimum=timing.budget.minimum;maximum=timing.budget.maximum;
  checks=timing.tooShort?'too_short':timing.tooLong?'too_long':
    timing.qualityIssues.length?'copy_quality':'pass';
  phase='director';
  const concept={...c,requested_sales_angle:salesAngleDirective(p.sales_angle),sales_angle_code:p.sales_angle,
   spoken_script:isFilmStyle(finalStyle)&&audioMode==='no_voice'?'':dialogue};
  const promptMax=Number(settings?.model_contract?.prompt_max_length||option?.prompt_max_length||12500);
  const director=buildCommercialDirectorPackage({
   concept,productName:normalizeProductCopy(p.product_name),
   description:normalizeProductCopy(p.description),cta:c.cta||p.cta,
   market:p.market_code,videoLanguage:p.video_language||'es',style:finalStyle,
   shotPreference:'auto',castMode,audioMode,duration:seconds,
   imageProvided:true,modelId:model,workflowId:workflow,
   promptMaxLength:Math.max(4000,Math.min(12500,promptMax-(workflow==='references'?99:workflow==='animate_image'?83:0))),
   productGeometry:research.product_visual_geometry||null,
   templateId:template?.id||null,templateActor:p.template_actor||'auto',
   templateSetting:p.template_setting||'auto',templateChangeRequest:p.template_change_request||''
  });
  phase='prompt_validation';
  if(director.prompt.length>promptMax)throw Error('invalid_video_configuration');
  phase='media';
  const assets=await db.query('SELECT expires_at FROM realizo_media_assets WHERE id='+sqlValue(p.primary_asset_id)+' AND user_id='+sqlValue(p.user_id)+' AND deleted_at IS NULL LIMIT 1');
  existingAsset=assets.length===1;
  aliveAsset=existingAsset&&Number(assets[0].expires_at)>Math.floor(Date.now()/1000)+60;
  phase='complete';
 }catch(e){
  const allowed=['invalid_video_configuration','premium_audio_cast_conflict',
   'commercial_direction_prompt_too_long','spoken_script_prompt_too_long',
   'invalid_concept','concept_unavailable','template_requires_30_seconds'];
  const msg=String(e?.message||'');
  outcome=allowed.includes(msg)?msg:e?.name==='TypeError'?'type_error':e?.name==='SyntaxError'?'syntax_error':'unexpected_exception';
  console.log('PREMIUM_APPROVAL_FAIL_PHASE='+phase);
  console.log('PREMIUM_APPROVAL_STACK_LOCATION='+String(e?.stack||'').split('\n').slice(1,2).join('').replace(/\((?:.*[/\\])?(.*:\d+:\d+)\)/,'($1)').slice(0,155));
 }
 console.log('PREMIUM_APPROVAL_AUDIT='+JSON.stringify({
  conceptIndex,modelKind:String(p.video_model_id||'').includes('flash')?'flash':String(p.video_model_id||'').includes('keyframe')?'keyframe':'reference',outcome,finalStyle,audioMode,castMode,modelAvailable,speechCount,minimum,maximum,
  checks,existingAsset,aliveAsset
 }));
 }
}
console.log('PREMIUM_APPROVAL_AUDIT_READ_ONLY=true');
