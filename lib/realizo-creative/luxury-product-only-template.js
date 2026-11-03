// Reusable Realizo template based on the user's successful 8-second Nippori
// Veo 3.1 reference-video result. A product photograph is identity input,
// never the first frame. No copy of the sample video is submitted to Muapi.
import {buildLuxuryFilmPrompt} from './sales-director.js';

export const LUXURY_TEMPLATE_ID='luxury-product-only';
export const LUXURY_TEMPLATE_MODEL_ID='veo3.1-reference-to-video';
export const LUXURY_TEMPLATE_DURATION=8;
export const LUXURY_TEMPLATE_RESOLUTION='720p';
// Sample from the owner's completed Muapi result. The provider may remove it
// after its published expiry; library must offer a non-video fallback.
export const LUXURY_TEMPLATE_SAMPLE_URL='https://cdn.muapi.ai/outputs/generated/73eb8071-c966-4ac8-ac41-fa01d7ae6db4_9a40c763.mp4';
export const LUXURY_TEMPLATE_SAMPLE_EXPIRES='2026-12-03T03:15:29Z';

const FOCUS=Object.freeze({
  auto:'the actual cap, truthful label or material surface visible on the reference product',
  cap:'the genuine cap and closure geometry visible in the reference',
  label:'the actual label print and curved packaging surface, with no invented lettering',
  texture:'the real container material and its naturally occurring microtexture'
});
export const LUXURY_TEMPLATE_FOCUS_OPTIONS=Object.freeze(Object.keys(FOCUS));

export function makeLuxuryProductOnlyInput({productName='',description='',imageUrl='',visualDetail='auto'}={}){
  const name=String(productName||'').replace(/[\r\n\t]/g,' ').replace(/\s+/g,' ').trim();
  const descriptionText=String(description||'').trim();
  if(!name || name.length>100 || descriptionText.length<15 || descriptionText.length>320 ||
     !/^https:\/\//.test(imageUrl) || imageUrl.length>1400 ||
     !Object.hasOwn(FOCUS,visualDetail)) throw Error('invalid_luxury_template_payload');
  const prompt=buildLuxuryFilmPrompt({
    style:'premium',castMode:'product_only',audioMode:'no_voice',
    product:name,duration:LUXURY_TEMPLATE_DURATION,shots:3,
    videoLanguage:'es',voice:'',imageProvided:true,
    macroDetail:FOCUS[visualDetail],
    capabilities:{usesReferenceImages:true,imageRole:'product_reference'},
  });
  if(!prompt.includes('PRODUCT_ONLY: ZERO HUMAN PIXELS') ||
     !prompt.includes('ABSOLUTE NO-VOICE AUDIO LOCK') ||
     prompt.length>5400)throw Error('invalid_luxury_template_prompt');
  return {
    template_id:LUXURY_TEMPLATE_ID,
    model_id:LUXURY_TEMPLATE_MODEL_ID,
    input:{
      prompt,
      images_list:[imageUrl],
      duration:LUXURY_TEMPLATE_DURATION,
      resolution:LUXURY_TEMPLATE_RESOLUTION,
      generate_audio:true
    }
  };
}
