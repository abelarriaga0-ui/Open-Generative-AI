import { getWalletEnvironment, requireWalletUser, jsonError } from '@/lib/wallet/server';
import { enforceSameOrigin } from '@/lib/wallet/access-auth';
import { ensureOwnedMedia } from '@/lib/wallet/live-video-models';
import { resolvePremiumVideoChoice } from '@/lib/realizo-creative/video-specs';
import { buildPremiumGenerationParams } from '@/lib/realizo-creative/premium-video-settings';
import {
  HYPERREAL_PRO_VERSION, normalizeHyperrealProBrief,
  planHyperrealProScenes, buildHyperrealProVideoPrompt
} from '@/lib/realizo-creative/hyperreal-pro';

export const dynamic = 'force-dynamic';
const fail = (error, status = 422) => Response.json(
  {error}, {status, headers: {'Cache-Control': 'private, no-store'}}
);

// Prepare is read-only: no provider calls, no fund reservation, no generated video.
// The existing wallet quote + explicit confirmation remain the only billing path.
export async function POST(request) {
  if (!enforceSameOrigin(request)) return fail('invalid_origin', 403);
  try {
    const env = await getWalletEnvironment();
    const user = await requireWalletUser(request, env);
    if (!user) return fail('not_authenticated', 401);
    if (Number(request.headers.get('content-length') || 0) > 12000)
      return fail('request_too_large', 413);
    const body = await request.json();
    let brief, choice;
    try {
      brief = normalizeHyperrealProBrief(body?.brief);
      choice = resolvePremiumVideoChoice(body?.model_id, brief.duration);
    } catch (e) {
      return fail(e.message === 'invalid_video_configuration' ? 'invalid_video_configuration' : e.message, 400);
    }
    // This module must use a TRUE reference-image model: not first-frame animation.
    if (choice.imageRole !== 'product_reference')
      return fail('reference_image_model_required', 422);
    if (typeof body?.image_url !== 'string' || body.image_url.length > 1200)
      return fail('invalid_media_reference', 422);
    try {
      await ensureOwnedMedia(env, user, {image_url: body.image_url});
    } catch {
      return fail('invalid_media_reference', 422);
    }
    const settings = {};
    if (typeof body?.resolution === 'string') settings.resolution = body.resolution;
    if (typeof body?.aspect_ratio === 'string') settings.aspect_ratio = body.aspect_ratio;
    if (typeof body?.quality === 'string') settings.quality = body.quality;
    let params;
    try {
      params = buildPremiumGenerationParams({
        modelId: choice.modelId, duration: brief.duration,
        settings, workflowId: choice.workflowId, imageRole: choice.imageRole,
        imageUrl: body.image_url, prompt: buildHyperrealProVideoPrompt(brief)
      });
    } catch {
      return fail('invalid_video_configuration', 422);
    }
    return Response.json({
      version: HYPERREAL_PRO_VERSION,
      scenes: planHyperrealProScenes(brief),
      params,
      method: 'single_video_multi_shot_prompt',
      caveat: 'Esta versión dirige cortes con un prompt sobre una referencia. Aún no crea imágenes independientes por escena ni monta varios clips.'
    }, {headers: {'Cache-Control': 'private, no-store'}});
  } catch (error) {
    return jsonError(error);
  }
}
