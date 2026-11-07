import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { ensureOwnedMedia } from '@/lib/wallet/live-video-models';
import { premiumVideoOptions } from '@/lib/realizo-creative/video-specs';
import { buildPremiumGenerationParams } from '@/lib/realizo-creative/premium-video-settings';
import {
  HYPERREAL_PRO_VERSION, normalizeHyperrealProBrief,
  planHyperrealProScenes, buildHyperrealProVideoPrompt
} from '@/lib/realizo-creative/hyperreal-pro';
import {
  resolveHyperrealModelFamily, buildKling40HyperrealParams
} from '@/lib/realizo-creative/hyperreal-model-routing';

export const dynamic = 'force-dynamic';
const fail = (error, status = 422) => Response.json(
  {error}, {status, headers: {'Cache-Control': 'private, no-store'}}
);

// Standalone and read-only preparation. No OpenAI request, Muapi generation,
// wallet reservation, or customer billing occurs at this endpoint.
export async function POST(request) {
  if (!enforceSameOrigin(request)) return fail('invalid_origin', 403);
  try {
    if (Number(request.headers.get('content-length') || 0) > 12000)
      return fail('request_too_large', 413);
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return fail('not_authenticated', 401);
    const body = await request.json();
    let brief, choice;
    const hasImage=typeof body?.image_url==='string'&&body.image_url.length>0;
    try {
      brief=normalizeHyperrealProBrief(body?.brief);
      choice=resolveHyperrealModelFamily(premiumVideoOptions(),body?.family_id,brief.duration,{hasImage});
    } catch(e) {
      return fail(['invalid_video_configuration','reference_image_model_required','text_video_model_required'].includes(e.message)?
        e.message:'invalid_hyperreal_brief',422);
    }
    if(hasImage) {
      if(body.image_url.length>1400)return fail('invalid_media_reference',422);
      try{await ensureOwnedMedia(env,user,{image_url:body.image_url});}
      catch{return fail('invalid_media_reference',422);}
    }
    const prompt=buildHyperrealProVideoPrompt(brief,{hasImage});
    let params;
    try {
      if(choice.nativeKling4){
        params=buildKling40HyperrealParams({
          choice,prompt,imageUrl:hasImage?body.image_url:'',aspectRatio:brief.format
        });
      }else{
        params=buildPremiumGenerationParams({
          modelId:choice.modelId,duration:brief.duration,
          settings:{aspect_ratio:brief.format},
          workflowId:choice.workflowId,imageRole:choice.imageRole,
          imageUrl:hasImage?body.image_url:'',prompt
        });
      }
    }catch{return fail('invalid_video_configuration',422);}
    return Response.json({
      version:HYPERREAL_PRO_VERSION,
      scenes:planHyperrealProScenes(brief),params,
      selected_model:choice.modelId,
      media_mode:hasImage?'reference':'text',
      method:'single_video_multi_shot_prompt',
      caveat:'Esta versión guía cortes dentro de una generación. No crea ni monta clips independientes.'
    },{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return jsonError(error);}
}
